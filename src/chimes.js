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
 * Every note is a sine carrier plus a 4× shimmer (12% level, decaying to 60% of
 * the note's duration). A failed/unsupported `AudioContext` leaves the call
 * silent instead of throwing into the caller.
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

/** Relative level and decay ratio of the shimmer partial. */
const SHIMMER_LEVEL = 0.12;
const SHIMMER_DURATION_RATIO = 0.6;

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
      scheduleSynthNote(ctx, ctx.destination, note.freq, start, outputVolume * note.level, note.duration);
    }
  }
}

/** One synthesized note: a sine carrier plus its 4× shimmer. */
function scheduleSynthNote(ctx, destination, freq, startTime, peak, duration) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration);

  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(freq * 4, startTime);
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0, startTime);
  shimmerGain.gain.linearRampToValueAtTime(peak * SHIMMER_LEVEL, startTime + 0.002);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * SHIMMER_DURATION_RATIO);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(destination);
  shimmer.start(startTime);
  shimmer.stop(startTime + duration);
}

module.exports = {
  SYNTH_NOTES,
  CHIME_VARIANTS,
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
