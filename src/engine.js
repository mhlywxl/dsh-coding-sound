/**
 * The music engine: one shared `AudioContext`, one shared voice chain, and one
 * gain per session.
 *
 * The signal path is the reference implementation's, with the single-session
 * master split into per-session voices:
 *
 *   per-session gain ─┬──────────────────────────────┐
 *                     └─ lowpass ─┬→ master ─→ out    │
 *                                 └→ convolver → wet ─┘
 *
 * One context per page, never one per session: browsers cap live contexts at a
 * handful. A session's music exists only while that session is running; the
 * context stays alive (suspended when idle) so the next session costs nothing.
 *
 * Note scheduling is entirely on the audio clock (`ctx.currentTime`); no timer
 * drives a note, so a throttled background page cannot shift the rhythm.
 */

const {
  SCALE_FREQS,
  OCTAVE_FREQS,
  TOKENS_PER_BEAT,
  MIN_BEAT_INTERVAL_MS,
  LOW_OCTAVE_CHANCE,
  DETUNE_SPREAD,
  VOICE_FADE_SECONDS,
  VOICE_STOP_SECONDS,
  VOICE_REAP_MS,
  presetConfig,
} = presets;

/** Preset used before a stored preference is known, and when one is invalid. */
const DEFAULT_PRESET = "digital";

/**
 * Spacing of one density step, shared by the live beat and the phase audition.
 *
 * The density setting is "characters per beat", but a streamed answer reaches
 * the page several characters per DOM flush, so the character gate on its own
 * cannot set the tempo: with a fixed floor the note rate was whatever the flush
 * cadence happened to be, and changing the setting was inaudible while the
 * audition (which used this spacing) responded. The live beat therefore uses the
 * same spacing, so the setting is heard everywhere and the audition predicts the
 * stream.
 */
const BEAT_INTERVAL_BASE_MS = 60;
const BEAT_INTERVAL_STEP_MS = 30;
/** Densities the setting offers; anything else is clamped into this range. */
const MIN_DENSITY = 1;
const MAX_DENSITY = 8;

/**
 * Minimum gap between two text-driven notes at one density, in milliseconds.
 * Never faster than {@link MIN_BEAT_INTERVAL_MS}, so a burst of characters can
 * still not stack notes.
 */
function densityIntervalMs(density) {
  const beats = Number.isFinite(density)
    ? Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, Math.round(density)))
    : TOKENS_PER_BEAT;
  return Math.max(MIN_BEAT_INTERVAL_MS, BEAT_INTERVAL_BASE_MS + beats * BEAT_INTERVAL_STEP_MS);
}

/**
 * Headroom between the moment a note is scheduled and the moment it starts.
 * The engine builds its nodes before reading the audio clock, so a stalled main
 * thread (a chat re-render right at a phase switch, a GC pause) cannot push the
 * start time into the past and turn the attack into a click.
 */
const SCHEDULE_LEAD_SECONDS = 0.02;

/**
 * Owns the page's single `AudioContext` and the first-gesture unlock.
 *
 * Opening a context outside a user gesture is allowed but starts it suspended;
 * `resume()` is therefore called on the first pointer/key event and whenever a
 * note is about to play. A browser without Web Audio reports `available()`
 * false instead of throwing into the caller.
 */
class AudioBus {
  constructor(ContextCtor) {
    this.ContextCtor = ContextCtor ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.audio = null;
  }

  available() {
    return typeof this.ContextCtor === "function";
  }

  context() {
    if (!this.available()) throw new Error("Web Audio is not available in this page");
    if (this.audio === null) this.audio = new this.ContextCtor();
    return this.audio;
  }

  /** Resume from the autoplay suspension; resolves to whether sound may start. */
  resume() {
    let audio;
    try {
      audio = this.context();
    } catch {
      return Promise.resolve(false);
    }
    if (audio.state === "running") return Promise.resolve(true);
    try {
      const result = audio.resume();
      if (result !== null && typeof result === "object" && typeof result.then === "function") {
        return result.then(
          () => audio.state === "running",
          () => false,
        );
      }
    } catch {
      return Promise.resolve(false);
    }
    return Promise.resolve(audio.state === "running");
  }

  /** Release the context; the plugin owns no page-lifetime audio after this. */
  dispose() {
    const audio = this.audio;
    this.audio = null;
    if (audio === null) return;
    try {
      const closing = audio.close();
      if (closing !== null && typeof closing === "object" && typeof closing.catch === "function") {
        closing.catch(() => undefined);
      }
    } catch {
      /* already closed */
    }
  }
}

/** All scheduled audio resources, owned by one MusicEngine. */
class MusicEngine {
  /**
   * @param {object} options
   * @param {AudioBus} options.bus
   * @param {() => number} [options.random] injectable for tests
   * @param {() => number} [options.clock] wall clock in ms, for the beat throttle
   */
  constructor(options) {
    this.bus = options.bus;
    this.random = options.random ?? Math.random;
    this.clock = options.clock ?? (() => performance.now());
    /** @type {ReturnType<typeof presetConfig> | null} the live response chain */
    this.chain = null;
    /** @type {string} */
    this.preset = DEFAULT_PRESET;
    /** @type {Map<string, {gain: GainNode, volume: number, paused: boolean, stopping: boolean}>} */
    this.voices = new Map();
    /** @type {Map<string, number>} characters waiting to reach a whole beat */
    this.carry = new Map();
    /** @type {Map<string, string>} phase the carry belongs to, so a phase switch starts clean */
    this.carryPhase = new Map();
    /** @type {Map<string, number>} wall-clock time of the last beat per session */
    this.lastBeat = new Map();
    /** @type {Map<string, AudioBuffer>} impulse responses, keyed by decay */
    this.impulses = new Map();
    /** @type {Set<ReturnType<typeof setTimeout>>} */
    this.timers = new Set();
  }

  /** Whether any session currently holds a voice. */
  isRunning() {
    for (const voice of this.voices.values()) if (!voice.stopping) return true;
    return false;
  }

  /** The live preset, or `off`. */
  getPreset() {
    return this.preset;
  }

  /**
   * Change the preset. A live chain is rebuilt in place (voices are reattached,
   * nothing restarts); `off` tears the chain down and silences every session.
   */
  setPreset(preset) {
    if (preset === this.preset) return;
    this.preset = preset;
    if (presetConfig(preset) === undefined) {
      this.#teardownChain();
      this.voices.clear();
      this.carry.clear();
      this.lastBeat.clear();
      return;
    }
    if (this.chain !== null) this.#rebuildChain();
  }

  /**
   * Add or revive one session's voice.
   * @returns {boolean} whether the voice exists (false without Web Audio).
   */
  startVoice(sessionId, volume) {
    if (presetConfig(this.preset) === undefined) return false;
    if (!this.#ensureChain()) return false;
    const existing = this.voices.get(sessionId);
    if (existing !== undefined) {
      existing.stopping = false;
      existing.paused = false;
      existing.volume = volume;
      this.#ramp(existing.gain.gain, volume, VOICE_FADE_SECONDS);
      return true;
    }
    let gain;
    try {
      gain = this.bus.context().createGain();
    } catch {
      return false;
    }
    gain.gain.value = 0;
    gain.connect(this.chain.filter);
    this.voices.set(sessionId, { gain, volume, paused: false, stopping: false });
    this.carry.set(sessionId, 0);
    this.carryPhase.delete(sessionId);
    this.lastBeat.delete(sessionId);
    this.#ramp(gain.gain, volume, VOICE_FADE_SECONDS);
    return true;
  }

  /** Update one voice's session-volume fraction (0–1). */
  setVolume(sessionId, volume) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined) return;
    voice.volume = volume;
    if (!voice.paused && !voice.stopping) this.#ramp(voice.gain.gain, volume, VOICE_FADE_SECONDS);
  }

  /** Fade one session's voice out while it waits for the user. */
  pauseVoice(sessionId) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined || voice.paused) return;
    voice.paused = true;
    this.#ramp(voice.gain.gain, 0, VOICE_FADE_SECONDS);
  }

  /** Bring a paused voice back after the interaction was answered. */
  resumeVoice(sessionId) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined || !voice.paused) return;
    voice.paused = false;
    this.#ramp(voice.gain.gain, voice.volume, VOICE_FADE_SECONDS);
  }

  /** Fade one voice out and reap it; the session's music is no longer running. */
  stopVoice(sessionId) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined) return;
    voice.stopping = true;
    voice.paused = false;
    this.#ramp(voice.gain.gain, 0, VOICE_STOP_SECONDS);
    this.#after(VOICE_REAP_MS, () => {
      const current = this.voices.get(sessionId);
      if (current !== voice) return;
      this.voices.delete(sessionId);
      this.carry.delete(sessionId);
      this.carryPhase.delete(sessionId);
      this.lastBeat.delete(sessionId);
      try {
        voice.gain.disconnect();
      } catch {
        /* already disconnected */
      }
      if (!this.isRunning()) this.#teardownChain();
    });
  }

  /** Silence every session immediately (plugin disposal). */
  stopAll() {
    for (const voice of this.voices.values()) {
      voice.stopping = true;
      this.#ramp(voice.gain.gain, 0, 0.05);
      try {
        voice.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.voices.clear();
    this.carry.clear();
    this.carryPhase.clear();
    this.lastBeat.clear();
    this.#teardownChain();
  }

  /**
   * Feed streamed characters into one session's beat counter.
   *
   * Two gates: one beat per `charactersPerBeat` characters, and never two beats
   * closer than that density's own spacing ({@link densityIntervalMs}) — the
   * same spacing the phase audition uses, so the setting is audible on the live
   * stream and not only in 试听. Characters that arrive during the throttle are
   * dropped rather than queued, which is what keeps the music on the text that
   * is being typed now instead of trailing it.
   *
   * @param {string} sessionId
   * @param {number} characters
   * @param {{charactersPerBeat?: number, velocity?: number, pitch?: "low"|"normal"|"high", phase?: string}} [options]
   *   `charactersPerBeat` is the per-phase density, `velocity` scales the
   *   envelope (the working pulse uses a lower value), `pitch` transposes the
   *   note by octaves, and `phase` resets the carry when the streamed phase
   *   changes so a reasoning remainder cannot sound in the answer.
   * @returns {boolean} whether a note was scheduled
   */
  note(sessionId, characters, options = {}) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined || voice.paused || voice.stopping) return false;
    if (this.chain === null || this.bus.audio === null) return false;
    if (!Number.isFinite(characters) || characters <= 0) return false;
    const perBeat = Number.isFinite(options.charactersPerBeat)
      ? Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, Math.round(options.charactersPerBeat)))
      : TOKENS_PER_BEAT;
    const phase = typeof options.phase === "string" ? options.phase : "answer";
    if (this.carryPhase.get(sessionId) !== phase) {
      this.carry.set(sessionId, 0);
      this.carryPhase.set(sessionId, phase);
    }
    const carry = (this.carry.get(sessionId) ?? 0) + characters;
    const beats = Math.floor(carry / perBeat);
    if (beats <= 0) {
      this.carry.set(sessionId, carry);
      return false;
    }
    this.carry.set(sessionId, carry % perBeat);
    const now = this.clock();
    if (now - (this.lastBeat.get(sessionId) ?? -Infinity) < densityIntervalMs(perBeat)) return false;
    this.lastBeat.set(sessionId, now);
    return this.#playNote(options.velocity ?? 1, options.pitch ?? "normal");
  }

  /**
   * Play one pulse note, bypassing the character carry.
   *
   * Used for the tool/idle phase, where there is no text to count. The same
   * per-session voice and throttle apply, so a pulse can never double up with a
   * text beat.
   */
  pulse(sessionId, options = {}) {
    const voice = this.voices.get(sessionId);
    if (voice === undefined || voice.paused || voice.stopping) return false;
    if (this.chain === null || this.bus.audio === null) return false;
    const now = this.clock();
    if (now - (this.lastBeat.get(sessionId) ?? -Infinity) < MIN_BEAT_INTERVAL_MS) return false;
    this.lastBeat.set(sessionId, now);
    return this.#playNote(options.velocity ?? 1, options.pitch ?? "normal");
  }

  /**
   * Play the reference audition: four ascending notes on the preset's own
   * response chain, twice as loud as the background layer.
   */
  preview(preset) {
    const config = presetConfig(preset);
    if (config === undefined) return false;
    let context;
    try {
      context = this.bus.context();
    } catch {
      return false;
    }
    void this.bus.resume();
    try {
      const chain = this.#buildAuditionChain(context, config);
      const notes = [SCALE_FREQS[0], SCALE_FREQS[2], SCALE_FREQS[4], SCALE_FREQS[6]];
      const base = context.currentTime + 0.01;
      notes.forEach((freq, index) => this.#auditionNote(context, chain.filter, config, freq, base + index * 0.05, 1));
      this.#after(3000, () => this.#disposeAuditionChain(chain));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Audition one phase: a short ascending phrase with that phase's pitch,
   * velocity and pacing, on the current preset's timbre. It works with no
   * running session and while the music preset is `off` (the default preset is
   * used then), so a phase can be heard before it ever plays live.
   *
   * @param {{count?: number, intervalMs?: number, density?: number, velocity?: number, pitch?: "low"|"normal"|"high"}} [options]
   *   `density` paces the phrase exactly like the live beat of that phase;
   *   `intervalMs` overrides it for callers that pace by time (the tool pulse).
   */
  previewPhrase(options = {}) {
    const config = presetConfig(this.preset) ?? presetConfig(DEFAULT_PRESET);
    let context;
    try {
      context = this.bus.context();
    } catch {
      return false;
    }
    void this.bus.resume();
    const count = Number.isFinite(options.count) ? Math.min(8, Math.max(1, Math.round(options.count))) : 4;
    const intervalMs = Number.isFinite(options.intervalMs)
      ? Math.min(4000, Math.max(40, Math.round(options.intervalMs)))
      : densityIntervalMs(Number.isFinite(options.density) ? options.density : TOKENS_PER_BEAT);
    const velocity = Number.isFinite(options.velocity) ? Math.min(1, Math.max(0, options.velocity)) : 1;
    const shift = options.pitch === "low" ? 0.5 : options.pitch === "high" ? 2 : 1;
    try {
      const chain = this.#buildAuditionChain(context, config);
      const scale = [SCALE_FREQS[0], SCALE_FREQS[2], SCALE_FREQS[4], SCALE_FREQS[6], SCALE_FREQS[1], SCALE_FREQS[3], SCALE_FREQS[5]];
      const base = context.currentTime + 0.01;
      for (let index = 0; index < count; index += 1) {
        const freq = (scale[index % scale.length] ?? SCALE_FREQS[0]) * shift;
        this.#auditionNote(context, chain.filter, config, freq, base + (index * intervalMs) / 1000, velocity);
      }
      this.#after(count * intervalMs + 1400, () => this.#disposeAuditionChain(chain));
      return true;
    } catch {
      return false;
    }
  }

  /** Drop every scheduled resource this engine owns (timers included). */
  dispose() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.stopAll();
    this.impulses.clear();
  }

  #ensureChain() {
    if (this.chain !== null) return true;
    if (presetConfig(this.preset) === undefined) return false;
    try {
      this.#buildChain();
      return true;
    } catch {
      return false;
    }
  }

  #buildChain() {
    const context = this.bus.context();
    const config = presetConfig(this.preset) ?? presetConfig(DEFAULT_PRESET);

    const master = context.createGain();
    master.gain.value = config.masterVolume;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = config.filterFreq;
    filter.Q.value = 1;
    filter.connect(master);

    const reverb = context.createConvolver();
    reverb.buffer = this.#impulse(config.reverbDecay);
    const wet = context.createGain();
    wet.gain.value = config.reverbWet;
    filter.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);

    this.chain = { master, filter, reverb, wet, config };
  }

  #rebuildChain() {
    const previous = this.chain;
    // Build the new chain first so a reattach never leaves a gap of silence,
    // then move every live voice across and drop the old nodes.
    this.chain = null;
    try {
      this.#buildChain();
    } catch {
      this.chain = previous;
      return;
    }
    for (const voice of this.voices.values()) {
      try {
        voice.gain.disconnect();
        voice.gain.connect(this.chain.filter);
      } catch {
        /* a reaped voice */
      }
    }
    if (previous !== null) {
      for (const node of [previous.filter, previous.reverb, previous.wet, previous.master]) {
        try {
          node.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    }
  }

  #teardownChain() {
    const chain = this.chain;
    this.chain = null;
    if (chain === null) return;
    for (const node of [chain.filter, chain.reverb, chain.wet, chain.master]) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  }

  /** A detached audition chain: same timbre as the live one, twice as loud. */
  #buildAuditionChain(context, config) {
    const master = context.createGain();
    master.gain.value = config.masterVolume * 2;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = config.filterFreq;
    filter.Q.value = 1;
    filter.connect(master);

    const reverb = context.createConvolver();
    reverb.buffer = this.#impulse(config.reverbDecay);
    const wet = context.createGain();
    wet.gain.value = config.reverbWet;
    filter.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);
    return { master, filter, reverb, wet };
  }

  #disposeAuditionChain(chain) {
    for (const node of [chain.filter, chain.reverb, chain.wet, chain.master]) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  }

  /** One audition note; the envelope is the reference preview's, scaled by velocity. */
  #auditionNote(context, destination, config, freq, start, velocity) {
    const level = Math.min(1, Math.max(0, velocity));
    const osc = context.createOscillator();
    osc.type = config.oscillatorType;
    osc.frequency.setValueAtTime(freq, start);

    const envelope = context.createGain();
    const gain = envelope.gain;
    gain.setValueAtTime(0, start);
    gain.linearRampToValueAtTime(level, start + config.attack);
    gain.linearRampToValueAtTime(config.sustain * level, start + config.attack + config.decay);
    gain.setValueAtTime(config.sustain * level, start + 0.05);
    gain.linearRampToValueAtTime(0.001, start + config.attack + config.decay + config.release);

    osc.connect(envelope);
    envelope.connect(destination);
    osc.start(start);
    osc.stop(start + config.attack + config.decay + config.release + 0.05);
  }

  /** Schedule one note on the shared chain; `velocity` scales the envelope. */
  #playNote(velocity = 1, pitch = "normal") {
    const chain = this.chain;
    if (chain === null) return false;
    let context;
    try {
      context = this.bus.context();
    } catch {
      return false;
    }
    // A suspended context freezes `currentTime`, so every note scheduled while
    // it waits would land on the same timestamp and fire together on resume —
    // the burst of overlapping notes that reads as a buzz/hiss. Drop the note
    // instead (and nudge the context awake) so the music simply resumes.
    if (context.state !== "running") {
      void this.bus.resume();
      return false;
    }
    const config = chain.config;
    const level = Number.isFinite(velocity) ? Math.min(1, Math.max(0, velocity)) : 1;
    const pitchShift = pitch === "low" ? 0.5 : pitch === "high" ? 2 : 1;
    const useLow = this.random() < LOW_OCTAVE_CHANCE;
    const scale = useLow ? OCTAVE_FREQS : SCALE_FREQS;
    const freq = scale[Math.floor(this.random() * scale.length)] ?? SCALE_FREQS[0];
    const detune = 1 + (this.random() - 0.5) * DETUNE_SPREAD;

    try {
      const osc = context.createOscillator();
      osc.type = config.oscillatorType;
      const envelope = context.createGain();
      // Read the audio clock once the nodes exist: a busy main thread (a chat
      // re-render right at a phase switch) could otherwise turn a 5 ms lead into
      // a start time in the past, truncating the attack into a click.
      const start = context.currentTime + SCHEDULE_LEAD_SECONDS;
      osc.frequency.setValueAtTime(freq * detune * pitchShift, start);

      const gain = envelope.gain;
      gain.setValueAtTime(0, start);
      gain.linearRampToValueAtTime(level, start + config.attack);
      gain.linearRampToValueAtTime(config.sustain * level, start + config.attack + config.decay);
      gain.setValueAtTime(config.sustain * level, start + config.attack + config.decay + 0.01);
      gain.linearRampToValueAtTime(0.001, start + config.attack + config.decay + 0.01 + config.release);

      osc.connect(envelope);
      envelope.connect(chain.filter);
      osc.start(start);
      osc.stop(start + config.attack + config.decay + config.release + 0.01);
      return true;
    } catch {
      return false;
    }
  }

  /** White-noise impulse response shaped like the reference's reverb tail. */
  #impulse(duration) {
    const key = String(duration);
    const cached = this.impulses.get(key);
    if (cached !== undefined) return cached;
    const context = this.bus.context();
    const sampleRate = context.sampleRate;
    const length = Math.max(Math.round(sampleRate * duration), 1);
    const buffer = context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const t = index / length;
        data[index] = (this.random() * 2 - 1) * Math.pow(1 - t, 1.5) * (1 + Math.sin(t * Math.PI * 3) * 0.3);
      }
    }
    this.impulses.set(key, buffer);
    return buffer;
  }

  #ramp(parameter, target, seconds) {
    try {
      const now = this.bus.audio?.currentTime ?? 0;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(parameter.value, now);
      parameter.linearRampToValueAtTime(target, now + seconds);
    } catch {
      /* a closed context */
    }
  }

  #after(milliseconds, callback) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, milliseconds);
    this.timers.add(timer);
  }
}

module.exports = {
  DEFAULT_PRESET,
  BEAT_INTERVAL_BASE_MS,
  BEAT_INTERVAL_STEP_MS,
  MIN_DENSITY,
  MAX_DENSITY,
  densityIntervalMs,
  AudioBus,
  MusicEngine,
};
