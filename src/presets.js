/**
 * Generative-music presets, ported parameter for parameter from the reference
 * desktop implementation (`generative-music.ts`).
 *
 * The numbers are not tuned here on purpose: the five dropdown entries must
 * sound like the reference, so every envelope, filter and reverb value is
 * copied exactly. `engine.js` only decides how those values are wired.
 */

/** Dropdown order in the Sound settings card. */
const PRESET_IDS = ["off", "ethereal", "classic", "digital", "retro"];

/** Presets that actually synthesize something (everything but `off`). */
const MUSIC_PRESETS = Object.freeze({
  classic: Object.freeze({
    oscillatorType: "triangle",
    attack: 0.01,
    decay: 0.2,
    sustain: 0.2,
    release: 0.3,
    filterFreq: 2000,
    reverbDecay: 0.3,
    reverbWet: 0.2,
    masterVolume: 0.08,
  }),
  ethereal: Object.freeze({
    oscillatorType: "sine",
    attack: 0.1,
    decay: 0.4,
    sustain: 0.4,
    release: 0.8,
    filterFreq: 3000,
    reverbDecay: 0.8,
    reverbWet: 0.35,
    masterVolume: 0.07,
  }),
  digital: Object.freeze({
    oscillatorType: "square",
    attack: 0.005,
    decay: 0.1,
    sustain: 0.1,
    release: 0.1,
    filterFreq: 5000,
    reverbDecay: 0.05,
    reverbWet: 0.05,
    masterVolume: 0.06,
  }),
  retro: Object.freeze({
    oscillatorType: "sawtooth",
    attack: 0.02,
    decay: 0.3,
    sustain: 0.3,
    release: 0.4,
    filterFreq: 1500,
    reverbDecay: 0.35,
    reverbWet: 0.25,
    masterVolume: 0.08,
  }),
});

/**
 * C-major pentatonic, C4–D5: no semitones, so every random order stays
 * consonant. The low octave is used 15% of the time.
 */
const SCALE_FREQS = Object.freeze([261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33]);
const OCTAVE_FREQS = Object.freeze([130.81, 146.83, 174.61, 196.0, 220.0, 261.63, 293.66]);

/** One beat per this many streamed characters (reference: per 4 tokens). */
const TOKENS_PER_BEAT = 4;

/** Two beats are never closer than this, regardless of how fast text arrives. */
const MIN_BEAT_INTERVAL_MS = 100;

/** Probability that a beat takes the low octave. */
const LOW_OCTAVE_CHANCE = 0.15;

/** Random detune applied to every note: ±5%. */
const DETUNE_SPREAD = 0.1;

/** Fade used when a session's music starts or stops, in seconds. */
const VOICE_FADE_SECONDS = 0.25;
/** Fade used when a running session finishes, in seconds (reference: 0.3). */
const VOICE_STOP_SECONDS = 0.3;
/** How long the voice is kept after its stop fade so the tail is not cut. */
const VOICE_REAP_MS = 420;

/** Whether a preset id synthesizes music. */
function isMusicPreset(preset) {
  return Object.hasOwn(MUSIC_PRESETS, preset);
}

/** Preset config, or undefined for `off`/unknown ids. */
function presetConfig(preset) {
  return isMusicPreset(preset) ? MUSIC_PRESETS[preset] : undefined;
}

module.exports = {
  PRESET_IDS,
  MUSIC_PRESETS,
  SCALE_FREQS,
  OCTAVE_FREQS,
  TOKENS_PER_BEAT,
  MIN_BEAT_INTERVAL_MS,
  LOW_OCTAVE_CHANCE,
  DETUNE_SPREAD,
  VOICE_FADE_SECONDS,
  VOICE_STOP_SECONDS,
  VOICE_REAP_MS,
  isMusicPreset,
  presetConfig,
};
