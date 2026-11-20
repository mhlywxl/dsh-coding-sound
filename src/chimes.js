/**
 * The two notification voices, synthesized.
 *
 * The `synth` option keeps the reference implementation's completion and
 * attention phrases. The four named options (`positive`, `correct`, `start`,
 * `back`) are synthesized renditions of the four interface sounds the plugin
 * originally bundled — rising, confirm, ascending arpeggio, descending — so the
 * package ships no third-party audio assets and every option still sounds
 * distinct.
 *
 * Playback is tuned for long listening: the phrase tables below keep the
 * reference intervals, while the player transposes them one octave down
 * ({@link CHIME_TRANSPOSE}) so the fundamentals sit at 261–1046 Hz instead of
 * 523–2093 Hz — below the ear's 2–5 kHz sensitivity peak — and uses a 2×
 * shimmer at 6% instead of a 4× shimmer at 12%. The attack is 8 ms rather than
 * 2 ms, which removes the edge a half-cycle ramp gives low notes. A trim keeps
 * the two alert voices present without being startling.
 *
 * Every note is a sine carrier plus its octave shimmer (decaying to 60% of the
 * note's duration). A failed/unsupported `AudioContext` leaves the call silent
 * instead of throwing into the caller.
 */

const { notificationVolumeToGain, chimeVariantLevel } = settings;

/**
 * The `synth` option, note for note: a kind-specific phrase.
 * `at` is seconds from the start, `level` is relative to the output volume.
 */
const SYNTH_NOTES = Object.freeze({
  success: Object.freeze([
    Object.freeze({ freq: 1318.5, at: 0, duration: 0.2, level: 0.35 }),
    Object.freeze({ freq: 1568.0, at: 0.07, duration: 0.22, level: 0.3 }),
    Object.freeze({ freq: 2093.0, at: 0.14, duration: 0.3, level: 0.24 }),
  ]),
  attention: Object.freeze([
    Object.freeze({ freq: 1760.0, at: 0, duration: 0.14, level: 0.4 }),
    Object.freeze({ freq: 1318.5, at: 0.09, duration: 0.22, level: 0.34 }),
  ]),
});

/**
 * The four named options. Each is one fixed phrase, used for both the
 * completion and the attention slot — the bundled samples behaved the same way.
 */
const CHIME_VARIANTS = Object.freeze({
  positive: Object.freeze([
    Object.freeze({ freq: 1318.5, at: 0, duration: 0.18, level: 0.34 }),
    Object.freeze({ freq: 1760.0, at: 0.08, duration: 0.3, level: 0.3 }),
  ]),
  correct: Object.freeze([
    Object.freeze({ freq: 1046.5, at: 0, duration: 0.16, level: 0.38 }),
    Object.freeze({ freq: 1568.0, at: 0.09, duration: 0.28, level: 0.32 }),
  ]),
  start: Object.freeze([
    Object.freeze({ freq: 523.25, at: 0, duration: 0.16, level: 0.3 }),
    Object.freeze({ freq: 659.25, at: 0.07, duration: 0.16, level: 0.3 }),
    Object.freeze({ freq: 783.99, at: 0.14, duration: 0.18, level: 0.3 }),
    Object.freeze({ freq: 1046.5, at: 0.21, duration: 0.36, level: 0.34 }),
  ]),
  back: Object.freeze([
    Object.freeze({ freq: 783.99, at: 0, duration: 0.16, level: 0.34 }),
    Object.freeze({ freq: 523.25, at: 0.08, duration: 0.3, level: 0.3 }),
  ]),
});

/**
 * Comfort tuning applied at playback, not baked into the reference tables.
 *
 * Human hearing is most sensitive around 2–5 kHz (the ear-canal resonance), and
 * sustained energy there is what makes a chime feel piercing after a while.
 * One octave down moves every fundamental into 261–1046 Hz, where the same
 * loudness is comfortable rather than sharp; the octave shimmer stays musical
 * and consonant. The slower attack avoids the transient click, and the trim
 * keeps the alert audible without jumping out of the background mix.
 */
const CHIME_TRANSPOSE = 0.5;
const CHIME_ATTACK_SECONDS = 0.008;
const SHIMMER_RATIO = 2;
const SHIMMER_LEVEL = 0.06;
const SHIMMER_DURATION_RATIO = 0.6;
const CHIME_OUTPUT_TRIM = 0.8;

/** How long one phrase keeps sounding, in seconds. */
function scheduleDuration(notes) {
  let end = 0;
  for (const note of notes ?? []) end = Math.max(end, note.at + note.duration);
  return end;
}

/** How long the `synth` option's phrase for one kind keeps sounding. */
function chimeDuration(kind) {
  return scheduleDuration(SYNTH_NOTES[kind]);
}

/** How long one named option's phrase keeps sounding. */
function variantDuration(preference) {
  return scheduleDuration(CHIME_VARIANTS[preference]);
}

/** The preference a chime kind uses under these settings. */
function preferredSound(settingsValue, kind) {
  return kind === "success" ? settingsValue.successSound : settingsValue.attentionSound;
}

/** The notes one preference plays for one chime kind, or undefined for `off`. */
function chimeNotes(preference, kind) {
  if (preference === "synth") return SYNTH_NOTES[kind];
  return CHIME_VARIANTS[preference];
}

/**
 * Plays the notification voices through one shared `AudioContext`.
 *
 * The context is owned elsewhere (`AudioBus`) because the music engine shares
 * it: one context per page keeps the browser's small context limit and the
 * autoplay gesture single.
 */
class ChimePlayer {
  /** @param {{bus: {context: () => AudioContext, resume: () => Promise<boolean>}}} options */
  constructor(options) {
    this.bus = options.bus;
  }

  /**
   * Play one chime kind, honoring `off`, `synth`, and the four variants.
   * @param {"success" | "attention"} kind
   * @param {ReturnType<typeof import("./settings.js").normalizeSettings>} settingsValue
   * @returns {boolean} whether sound was scheduled
   */
  play(kind, settingsValue) {
    const preference = preferredSound(settingsValue, kind);
    if (preference === "off") return false;
    const volume = notificationVolumeToGain(settingsValue.notifyVolume);
    if (volume <= 0) return false;
    const notes = chimeNotes(preference, kind);
    if (notes === undefined) return false;
    // `synth` uses the reference levels as they are; the named options carry the
    // loudness ratio the trimmed samples had.
    const output = preference === "synth" ? volume : volume * chimeVariantLevel(preference, 1);
    this.#play(notes, output);
    return true;
  }

  /** Play one chime kind right now; used by 试听. */
  preview(kind, settingsValue) {
    return this.play(kind, settingsValue);
  }

  #play(notes, outputVolume) {
    let ctx;
    try {
      ctx = this.bus.context();
    } catch {
      return;
    }
    void this.bus.resume();
    const base = ctx.currentTime + 0.01;
    for (const note of notes) {
      const start = base + note.at;
      scheduleSynthNote(
        ctx,
        ctx.destination,
        note.freq * CHIME_TRANSPOSE,
        start,
        outputVolume * note.level * CHIME_OUTPUT_TRIM,
        note.duration,
      );
    }
  }
}

/** One synthesized note: a sine carrier plus its octave shimmer. */
function scheduleSynthNote(ctx, destination, freq, startTime, peak, duration) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + CHIME_ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration);

  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(freq * SHIMMER_RATIO, startTime);
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0, startTime);
  shimmerGain.gain.linearRampToValueAtTime(peak * SHIMMER_LEVEL, startTime + CHIME_ATTACK_SECONDS);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * SHIMMER_DURATION_RATIO);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(destination);
  shimmer.start(startTime);
  shimmer.stop(startTime + duration);
}

module.exports = {
  SYNTH_NOTES,
  CHIME_VARIANTS,
  CHIME_TRANSPOSE,
  CHIME_ATTACK_SECONDS,
  CHIME_OUTPUT_TRIM,
  SHIMMER_RATIO,
  SHIMMER_LEVEL,
  SHIMMER_DURATION_RATIO,
  scheduleDuration,
  chimeDuration,
  variantDuration,
  preferredSound,
  chimeNotes,
  scheduleSynthNote,
  ChimePlayer,
};
