/**
 * Offline test bench for the coding-sound plugin.
 *
 * No browser and no dependencies: the sources under `src/` are evaluated in
 * Node through the same module graph `build.mjs` generates, and the DOM the
 * observer needs is a small fake. Run with `node test.mjs` (or `npm test`).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

import { LOAD_LINE, assemble, target } from "./build.mjs";

const here = (path) => new URL(path, import.meta.url);

const DEFS = [
  ["presets", [], "src/presets.js"],
  ["settings", ["presets"], "src/settings.js"],
  ["chimes", ["settings"], "src/chimes.js"],
  ["engine", ["presets"], "src/engine.js"],
  ["observer", [], "src/observer.js"],
  ["sessions", ["presets", "settings"], "src/sessions.js"],
  [
    "client",
    ["presets", "settings", "chimes", "engine", "observer", "sessions"],
    "src/client.js",
  ],
];

/** Evaluate the `src/` module graph exactly like the generated bundle does. */
function loadGraph() {
  const cache = new Map();
  const load = (id) => {
    if (cache.has(id)) return cache.get(id);
    const definition = DEFS.find((entry) => entry[0] === id);
    assert.ok(definition, `unknown module ${id}`);
    const code = readFileSync(here(definition[2]), "utf8");
    const factory = new Function("module", "exports", "require", ...definition[1], code);
    const module = { exports: {} };
    const dependencies = definition[1].map(load);
    factory(
      module,
      module.exports,
      () => {
        throw new Error(`no platform module in the offline bench (${id})`);
      },
      ...dependencies,
    );
    cache.set(id, module.exports);
    return module.exports;
  };
  return { load };
}

const graph = loadGraph();
const presets = graph.load("presets");
const settings = graph.load("settings");
const chimes = graph.load("chimes");
const observer = graph.load("observer");
const sessions = graph.load("sessions");

/** A tiny DOM element: enough for the observer's walker and root lookup. */
class FakeElement {
  constructor(tagName = "DIV", options = {}) {
    this.nodeType = 1;
    this.tagName = tagName;
    this.className = options.className ?? "";
    this.attrs = options.attrs ?? {};
    this.childNodes = [];
    this.parentElement = null;
    this.isConnected = true;
    for (const child of options.children ?? []) this.appendChild(child);
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  getAttribute(name) {
    return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
  }

  hasAttribute(name) {
    return Object.hasOwn(this.attrs, name);
  }

  querySelectorAll(selector) {
    const name = selector.slice(1, -1);
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (child.hasAttribute(name)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

const text = (value) => ({ nodeType: 3, data: value, parentElement: null });

// ---------------------------------------------------------------------------
// Build artifact and package manifest
// ---------------------------------------------------------------------------

test("client.js is the current build output", () => {
  assert.ok(existsSync(target), "client.js must exist");
  const artifact = readFileSync(target, "utf8");
  assert.equal(artifact, assemble());
  assert.ok(artifact.includes(LOAD_LINE));
  assert.ok(artifact.includes('id: "dsh-coding-sound"'));
  assert.ok(artifact.includes("window.__ModuleLoader__.load"));
});

test("package manifest and cordis patch agree on the package name", () => {
  const manifest = JSON.parse(readFileSync(here("package.json"), "utf8"));
  assert.equal(manifest.name, "dsh-coding-sound");
  assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(manifest.dsh.client.platform, "web");
  assert.equal(manifest.dsh.client.immediately, true);
  assert.ok(manifest.exports["./client"], "the browser half must be exported");
  for (const file of ["index.js", "client.js", "cordis.patch.yml", "icon.svg"]) {
    assert.ok(manifest.files.includes(file), `${file} must stay in files`);
  }
  const patch = readFileSync(here("cordis.patch.yml"), "utf8");
  assert.ok(patch.includes("id: coding-sound"));
  assert.ok(patch.includes("name: 'dsh-coding-sound'"));
  for (const localeFile of ["en", "zh"]) {
    const dictionary = JSON.parse(readFileSync(here(`locale/${localeFile}.json`), "utf8"));
    assert.ok(dictionary.meta.title.length > 0);
    assert.ok(dictionary.meta.description.length > 0);
  }
  assert.ok(statSync(here("icon.svg")).size < 256 * 1024);
});

test("the package ships no third-party audio assets", () => {
  assert.equal(existsSync(here("assets")), false, "the samples were replaced by synthesized chimes");
  const manifest = JSON.parse(readFileSync(here("package.json"), "utf8"));
  assert.equal(manifest.files.some((file) => file.includes("wav") || file.includes("assets")), false);
  assert.equal(manifest.private, undefined, "the package must be publishable");
  assert.equal(manifest.author, "mhlywxl");
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

test("preset table matches the reference parameter for parameter", () => {
  assert.deepEqual([...presets.PRESET_IDS], ["off", "ethereal", "classic", "digital", "retro"]);
  assert.deepEqual(presets.MUSIC_PRESETS.classic, {
    oscillatorType: "triangle",
    attack: 0.01,
    decay: 0.2,
    sustain: 0.2,
    release: 0.3,
    filterFreq: 2000,
    reverbDecay: 0.3,
    reverbWet: 0.2,
    masterVolume: 0.08,
  });
  assert.deepEqual(presets.MUSIC_PRESETS.ethereal, {
    oscillatorType: "sine",
    attack: 0.1,
    decay: 0.4,
    sustain: 0.4,
    release: 0.8,
    filterFreq: 3000,
    reverbDecay: 0.8,
    reverbWet: 0.35,
    masterVolume: 0.07,
  });
  assert.deepEqual(presets.MUSIC_PRESETS.digital, {
    oscillatorType: "square",
    attack: 0.005,
    decay: 0.1,
    sustain: 0.1,
    release: 0.1,
    filterFreq: 5000,
    reverbDecay: 0.05,
    reverbWet: 0.05,
    masterVolume: 0.06,
  });
  assert.deepEqual(presets.MUSIC_PRESETS.retro, {
    oscillatorType: "sawtooth",
    attack: 0.02,
    decay: 0.3,
    sustain: 0.3,
    release: 0.4,
    filterFreq: 1500,
    reverbDecay: 0.35,
    reverbWet: 0.25,
    masterVolume: 0.08,
  });
  assert.deepEqual([...presets.SCALE_FREQS], [261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33]);
  assert.deepEqual([...presets.OCTAVE_FREQS], [130.81, 146.83, 174.61, 196.0, 220.0, 261.63, 293.66]);
  assert.equal(presets.TOKENS_PER_BEAT, 4);
  assert.equal(presets.MIN_BEAT_INTERVAL_MS, 100);
  assert.equal(presets.LOW_OCTAVE_CHANCE, 0.15);
  assert.equal(presets.DETUNE_SPREAD, 0.1);
  assert.equal(presets.isMusicPreset("off"), false);
  assert.equal(presets.isMusicPreset("retro"), true);
  assert.equal(presets.presetConfig("off"), undefined);
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test("defaults and normalization are hardened", () => {
  assert.deepEqual(settings.normalizeSettings(undefined), settings.DEFAULTS);
  assert.equal(settings.DEFAULTS.musicPreset, "ethereal");
  assert.equal(settings.DEFAULTS.notifyVolume, 70);
  assert.equal(settings.DEFAULTS.musicVolumeCurrent, 100);
  assert.equal(settings.DEFAULTS.musicVolumeOther, 35);
  assert.equal(settings.normalizeSettings({ musicPreset: "nope" }).musicPreset, "ethereal");
  assert.equal(settings.normalizeSettings({ successSound: "nope" }).successSound, "synth");
  assert.equal(settings.normalizeSettings({ notifyVolume: "130" }).notifyVolume, 100);
  assert.equal(settings.normalizeSettings({ notifyVolume: -5 }).notifyVolume, 0);
  assert.equal(settings.normalizeSettings({ notifyVolume: "abc" }).notifyVolume, 70);
  assert.equal(settings.normalizeSettings({ notifyVolume: 72.6 }).notifyVolume, 73);
  assert.equal(settings.normalizeSettings({ musicVolumeCurrent: 120 }).musicVolumeCurrent, 100);
});

test("per-phase defaults, clamping, and merging", () => {
  assert.equal(settings.DEFAULTS.thinkingSound, true);
  assert.equal(settings.DEFAULTS.thinkingDensity, 2);
  assert.equal(settings.DEFAULTS.thinkingPitch, "normal");
  assert.equal(settings.DEFAULTS.answerSound, true);
  assert.equal(settings.DEFAULTS.answerDensity, 4);
  assert.equal(settings.DEFAULTS.answerPitch, "normal");
  assert.equal(settings.DEFAULTS.toolSound, "900");
  assert.equal(settings.DEFAULTS.toolPitch, "normal");
  assert.deepEqual([...settings.DENSITY_VALUES], [1, 2, 3, 4, 6, 8]);
  assert.deepEqual([...settings.PITCH_IDS], ["low", "normal", "high"]);
  assert.deepEqual(
    [...settings.TOOL_SPEED_IDS],
    ["off", "100", "150", "200", "300", "400", "600", "900", "1200", "1600", "2000"],
  );
  assert.deepEqual(
    { ...settings.TOOL_PULSE_INTERVALS },
    { 100: 100, 150: 150, 200: 200, 300: 300, 400: 400, 600: 600, 900: 900, 1200: 1200, 1600: 1600, 2000: 2000 },
  );
  assert.equal(settings.normalizeSettings({ toolSound: "100" }).toolSound, "100");

  assert.equal(settings.normalizeSettings({ thinkingSound: false }).thinkingSound, false);
  assert.equal(settings.normalizeSettings({ thinkingDensity: 0 }).thinkingDensity, 1);
  assert.equal(settings.normalizeSettings({ thinkingDensity: 99 }).thinkingDensity, 8);
  assert.equal(settings.normalizeSettings({ answerDensity: "3.6" }).answerDensity, 4);
  assert.equal(settings.normalizeSettings({ thinkingPitch: "ultra" }).thinkingPitch, "normal");
  assert.equal(settings.normalizeSettings({ answerPitch: "high" }).answerPitch, "high");
  assert.equal(settings.normalizeSettings({ toolSound: "off" }).toolSound, "off");
  assert.equal(settings.normalizeSettings({ toolSound: "1600" }).toolSound, "1600");
  assert.equal(settings.normalizeSettings({ toolSound: "warp" }).toolSound, "900");
  // The three-step card's values keep their meaning instead of resetting.
  assert.equal(settings.normalizeSettings({ toolSound: "slow" }).toolSound, "1200");
  assert.equal(settings.normalizeSettings({ toolSound: "normal" }).toolSound, "900");
  assert.equal(settings.normalizeSettings({ toolSound: "fast" }).toolSound, "600");
  assert.equal(settings.normalizeSettings({ toolPitch: "high" }).toolPitch, "high");
  assert.equal(settings.normalizeSettings({ toolPitch: "ultra" }).toolPitch, "normal");
  assert.equal(settings.normalizeSettings({ thinkingSound: "yes" }).thinkingSound, true);

  const merged = settings.resolveSettings({ thinkingDensity: 6 }, { thinkingDensity: 1 });
  assert.equal(merged.thinkingDensity, 1);
  assert.equal(merged.answerDensity, 4);
});

test("browser-local settings win over Host defaults, field by field", () => {
  const host = { musicPreset: "retro", notifyVolume: 40, successSound: "positive" };
  const resolved = settings.resolveSettings(host, { notifyVolume: 90 });
  assert.equal(resolved.musicPreset, "retro");
  assert.equal(resolved.notifyVolume, 90);
  assert.equal(resolved.successSound, "positive");
  assert.equal(resolved.attentionSound, "synth");
  assert.equal(resolved.musicVolumeOther, 35);
});

test("the three-state badge counts audible layers", () => {
  const { summarizeSoundStatus } = settings;
  assert.equal(summarizeSoundStatus("off", "off", "off", 70), "allOff");
  assert.equal(summarizeSoundStatus("off", "synth", "off", 0), "allOff", "0% mutes both chimes");
  assert.equal(summarizeSoundStatus("ethereal", "off", "off", 70), "enabled");
  assert.equal(summarizeSoundStatus("off", "synth", "off", 70), "enabled");
  assert.equal(summarizeSoundStatus("off", "synth", "synth", 70), "custom");
  assert.equal(summarizeSoundStatus("ethereal", "synth", "off", 70), "custom");
  assert.equal(summarizeSoundStatus("off", "synth", "synth", 0), "allOff");
});

test("notification volume maps to gain and the named options keep their levels", () => {
  assert.equal(settings.notificationVolumeToGain(70), 0.7);
  assert.equal(settings.notificationVolumeToGain(100), 1);
  assert.equal(settings.notificationVolumeToGain(0), 0);
  assert.equal(settings.chimeVariantLevel("positive", 0.7), 0.7 * 0.62);
  assert.equal(settings.chimeVariantLevel("correct", 0.7), 0.7 * 0.85);
  assert.equal(settings.chimeVariantLevel("start", 0.7), 0.7);
  assert.equal(settings.chimeVariantLevel("back", 0.7), 0.7 * 0.7);
  assert.equal(settings.chimeVariantLevel("unknown", 1), 0);
  assert.deepEqual({ ...settings.CHIME_VARIANT_LEVEL }, { positive: 0.62, correct: 0.85, start: 1, back: 0.7 });
  assert.equal(settings.successChimeAudible({ ...settings.DEFAULTS, notifyVolume: 0 }), false);
  assert.equal(settings.successChimeAudible({ ...settings.DEFAULTS, successSound: "off" }), false);
});

test("an approval is announced once, even after a replay", () => {
  const event = { kind: "approval", turnId: "turn-1", promptId: "prompt-7" };
  const key = settings.attentionChimeEventKey(event);
  assert.equal(key, 'turn:["approval","turn-1","prompt-7"]');
  const seen = new Set();
  assert.equal(settings.shouldPlayAttentionChimeForEvent(event, seen), true);
  assert.equal(settings.shouldPlayAttentionChimeForEvent(event, seen), false, "same prompt is deduped");
  assert.equal(settings.shouldPlayAttentionChimeForEvent({ ...event, promptId: "prompt-8" }, seen), true);
  assert.equal(settings.attentionChimeEventKey({ kind: "approval" }), undefined, "no identity, no chime");
});

test("the dedupe set is bounded and keeps turn keys across a rebuild", () => {
  const seen = new Set();
  for (let index = 0; index < settings.ATTENTION_CHIME_SEEN_CAP + 10; index += 1) {
    settings.shouldPlayAttentionChimeForEvent({ kind: "ask", turnId: `t${index}`, promptId: `p${index}` }, seen);
  }
  assert.ok(seen.size <= settings.ATTENTION_CHIME_SEEN_CAP);
  seen.add("approval:tab-1:p1");
  settings.clearAttentionChimeKeys(seen);
  assert.ok([...seen].every((key) => key.startsWith("turn:")), "non-turn keys are dropped after a rebuild");
  assert.ok(settings.shouldPlayAttentionChimeForEvent({ kind: "approval", turnId: "t", promptId: "p" }, seen));
});

test("the settings store persists only this browser's overrides", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, value),
  };
  const store = new settings.SettingsStore(storage, { musicPreset: "retro", notifyVolume: 40 });
  assert.equal(store.get().musicPreset, "retro");
  store.set({ notifyVolume: 80 });
  assert.equal(store.get().notifyVolume, 80);
  assert.deepEqual(JSON.parse(memory.get(settings.STORAGE_KEY)), { notifyVolume: 80 });
  store.setHostDefaults({ musicPreset: "classic", notifyVolume: 10 });
  assert.equal(store.get().musicPreset, "classic");
  assert.equal(store.get().notifyVolume, 80, "the browser override still wins");
  assert.equal(store.isExpanded(), true);
  store.setExpanded(false);
  assert.equal(memory.get(settings.EXPANDED_KEY), "0");
});

// ---------------------------------------------------------------------------
// Chimes
// ---------------------------------------------------------------------------

test("synthesized chimes keep the reference phrases and distinct variants", () => {
  assert.deepEqual(chimes.SYNTH_NOTES.success, [
    { freq: 1318.5, at: 0, duration: 0.2, level: 0.35 },
    { freq: 1568.0, at: 0.07, duration: 0.22, level: 0.3 },
    { freq: 2093.0, at: 0.14, duration: 0.3, level: 0.24 },
  ]);
  assert.deepEqual(chimes.SYNTH_NOTES.attention, [
    { freq: 1760.0, at: 0, duration: 0.14, level: 0.4 },
    { freq: 1318.5, at: 0.09, duration: 0.22, level: 0.34 },
  ]);
  assert.equal(chimes.chimeDuration("success"), 0.44);
  assert.equal(chimes.chimeDuration("attention"), 0.31);
  assert.equal(chimes.SHIMMER_LEVEL, 0.12);

  // Four named options, each a different phrase shape: rising, confirm,
  // ascending arpeggio, descending.
  assert.deepEqual(chimes.CHIME_VARIANTS.positive.map((note) => note.freq), [1318.5, 1760]);
  assert.deepEqual(chimes.CHIME_VARIANTS.correct.map((note) => note.freq), [1046.5, 1568]);
  assert.deepEqual(chimes.CHIME_VARIANTS.start.map((note) => note.freq), [523.25, 659.25, 783.99, 1046.5]);
  assert.deepEqual(chimes.CHIME_VARIANTS.back.map((note) => note.freq), [783.99, 523.25]);
  assert.equal(chimes.variantDuration("start"), 0.57);
  assert.equal(chimes.variantDuration("positive"), 0.38);
  assert.equal(chimes.chimeNotes("synth", "success"), chimes.SYNTH_NOTES.success);
  assert.equal(chimes.chimeNotes("synth", "attention"), chimes.SYNTH_NOTES.attention);
  assert.equal(chimes.chimeNotes("back", "success"), chimes.CHIME_VARIANTS.back);
  assert.equal(chimes.chimeNotes("back", "attention"), chimes.CHIME_VARIANTS.back);
  assert.equal(chimes.chimeNotes("off", "success"), undefined);

  assert.equal(chimes.preferredSound({ ...settings.DEFAULTS, successSound: "back" }, "success"), "back");
  assert.equal(chimes.preferredSound({ ...settings.DEFAULTS, attentionSound: "start" }, "attention"), "start");
});

// ---------------------------------------------------------------------------
// Session edges
// ---------------------------------------------------------------------------

test("session edges report start, stop, and both interaction edges", () => {
  const previous = sessions.normalizeSessions(
    new Map([
      ["a", { running: true }],
      ["b", { running: true }],
      ["c", { running: false }],
    ]),
  );
  const next = sessions.normalizeSessions(
    new Map([
      ["a", { running: false, pendingInteraction: { kind: "approval", id: "p1", turnId: "t1" } }],
      ["b", { running: true }],
      ["c", { running: true }],
    ]),
  );
  const edges = sessions.deriveSessionEdges(previous, next);
  assert.deepEqual(edges.started, ["c"]);
  assert.deepEqual(edges.stopped, ["a"]);
  assert.deepEqual(edges.pendingStarted, ["a"]);
  assert.deepEqual(edges.pendingEnded, []);
});

test("a pending interaction pauses one session only", () => {
  const previous = sessions.normalizeSessions(
    new Map([
      ["a", { running: true }],
      ["b", { running: true }],
    ]),
  );
  const next = sessions.normalizeSessions(
    new Map([
      ["a", { running: true, pendingInteraction: { kind: "ask", prompt: { id: "q1" }, turnId: "t2" } }],
      ["b", { running: true }],
    ]),
  );
  const edges = sessions.deriveSessionEdges(previous, next);
  assert.deepEqual(edges.pendingStarted, ["a"]);
  assert.deepEqual(edges.stopped, []);
  assert.deepEqual(edges.started, []);
});

test("a removed session counts as stopped", () => {
  const previous = sessions.normalizeSessions(new Map([["a", { running: true }]]));
  const edges = sessions.deriveSessionEdges(previous, new Map());
  assert.deepEqual(edges.stopped, ["a"]);
});

test("pending identities are stable and namespaced per session", () => {
  const one = sessions.pendingIdentity({ kind: "approval", prompt: { id: "p1" }, turnId: "t1" });
  const two = sessions.pendingIdentity({ kind: "approval", prompt: { id: "p1" }, turnId: "t1" });
  assert.deepEqual(one, two);
  assert.equal(one.kind, "approval");
  assert.equal(one.promptId, "p1");
  assert.equal(one.turnId, "t1");
  const shapeless = sessions.pendingIdentity({ kind: "ask" });
  assert.equal(shapeless.kind, "ask");
  assert.ok(shapeless.signature.length > 0);
});

// ---------------------------------------------------------------------------
// SessionVoices orchestration
// ---------------------------------------------------------------------------

function fakeEngine() {
  return {
    calls: [],
    startVoice(id, volume) {
      this.calls.push(["start", id, volume]);
      return true;
    },
    stopVoice(id) {
      this.calls.push(["stop", id]);
    },
    pauseVoice(id) {
      this.calls.push(["pause", id]);
    },
    resumeVoice(id) {
      this.calls.push(["resume", id]);
    },
    setVolume(id, volume) {
      this.calls.push(["volume", id, volume]);
    },
    note(id, characters, options) {
      this.calls.push(["note", id, characters, options]);
      return true;
    },
    pulse(id, options) {
      this.calls.push(["pulse", id, options]);
      return true;
    },
  };
}

function fakeChimes() {
  return {
    calls: [],
    play(kind) {
      this.calls.push(kind);
      return Promise.resolve(true);
    },
  };
}

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildVoices(overrides = {}) {
  const engine = fakeEngine();
  const chimes = fakeChimes();
  let current = overrides.current ?? "a";
  const voices = new sessions.SessionVoices({
    engine,
    chimes,
    getSettings: () => overrides.settings ?? settings.DEFAULTS,
    getCurrentId: () => current,
    isSubagent: overrides.isSubagent ?? (() => false),
    clock: overrides.clock ?? (() => 0),
    random: () => 0,
    successDebounceMs: 5,
  });
  return { engine, chimes, voices, switchTo: (id) => (current = id) };
}

test("opening the page onto a running session starts no chime", () => {
  const { engine, chimes, voices } = buildVoices();
  voices.apply(new Map([["a", { running: true }]]));
  assert.deepEqual(engine.calls, [["start", "a", 1]]);
  assert.deepEqual(chimes.calls, []);
});

test("completion rings for the current session only, after the debounce", async () => {
  const { engine, chimes, voices, switchTo } = buildVoices();
  voices.apply(new Map([["a", { running: true }]]));
  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  voices.apply(new Map([["a", { running: false }], ["b", { running: true }]]));
  await tick(20);
  assert.deepEqual(chimes.calls, ["success"]);
  assert.ok(engine.calls.some((call) => call[0] === "stop" && call[1] === "a"));

  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  switchTo("b");
  voices.apply(new Map([["a", { running: false }], ["b", { running: true }]]));
  await tick(20);
  assert.deepEqual(chimes.calls, ["success"], "a non-current completion stays silent");
});

test("a subagent never rings completion", async () => {
  const { chimes, voices } = buildVoices({ isSubagent: () => true });
  voices.apply(new Map([["a", { running: true }]]));
  voices.apply(new Map([["a", { running: false }]]));
  await tick(20);
  assert.deepEqual(chimes.calls, []);
});

test("an interaction pauses only its own voice and rings once", () => {
  const { engine, chimes, voices } = buildVoices();
  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  const pending = { kind: "approval", prompt: { id: "p1" }, turnId: "t1" };
  voices.apply(new Map([["a", { running: true, pendingInteraction: pending }], ["b", { running: true }]]));
  assert.ok(engine.calls.some((call) => call[0] === "pause" && call[1] === "a"));
  assert.deepEqual(chimes.calls, ["attention"]);
  // The same prompt re-delivered by a replay must not ring again.
  voices.apply(new Map([["a", { running: true, pendingInteraction: pending }], ["b", { running: true }]]));
  assert.deepEqual(chimes.calls, ["attention"]);
  // Answering it resumes that voice, and the other session never stopped.
  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  assert.ok(engine.calls.some((call) => call[0] === "resume" && call[1] === "a"));
});

test("current and other sessions use their own volume", () => {
  const { engine, voices, switchTo } = buildVoices();
  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  assert.ok(engine.calls.some((call) => call[0] === "start" && call[1] === "a" && call[2] === 1));
  assert.ok(engine.calls.some((call) => call[0] === "start" && call[1] === "b" && call[2] === 0.35));
  switchTo("b");
  voices.setCurrent();
  assert.ok(engine.calls.some((call) => call[0] === "volume" && call[1] === "a" && call[2] === 0.35));
  assert.ok(engine.calls.some((call) => call[0] === "volume" && call[1] === "b" && call[2] === 1));
});

test("text in the current answer drives beats; background sessions get a slow pulse", () => {
  let now = 0;
  const { engine, voices } = buildVoices({ clock: () => now });
  voices.apply(new Map([["a", { running: true }], ["b", { running: true }]]));
  voices.onCurrentCharacters("abcdefgh");
  assert.ok(engine.calls.some((call) => call[0] === "note" && call[1] === "a" && call[2] === 8));
  now = 1000;
  voices.tick();
  assert.ok(engine.calls.some((call) => call[0] === "note" && call[1] === "b"));
  now = 1100;
  const before = engine.calls.filter((call) => call[0] === "note" && call[1] === "b").length;
  voices.tick();
  const after = engine.calls.filter((call) => call[0] === "note" && call[1] === "b").length;
  assert.equal(after, before, "the ambience pulse respects its 700–1100 ms gap");
});

test("a full-velocity working pulse keeps the current session audible during tools and pauses", () => {
  let now = 0;
  const { engine, voices } = buildVoices({ clock: () => now });
  voices.apply(new Map([["a", { running: true }]]));
  const pulses = () => engine.calls.filter((call) => call[0] === "pulse");
  assert.equal(pulses().length, 0, "no pulse while a turn is just starting");

  now = sessions.WORKING_PULSE_IDLE_MS - 200;
  voices.tick();
  assert.equal(pulses().length, 0, "the idle window still holds");

  now = sessions.WORKING_PULSE_IDLE_MS + 100;
  voices.tick();
  // No `velocity`: the pulse sounds at the same level as a text beat.
  assert.deepEqual(pulses(), [["pulse", "a", { pitch: "normal" }]]);

  now += settings.TOOL_PULSE_INTERVALS["900"] - 100;
  voices.tick();
  assert.equal(pulses().length, 1, "the pulse interval is respected");

  now += 200;
  voices.tick();
  assert.equal(pulses().length, 2);

  // A token beat resets the idle window, so a pulse never doubles up on text.
  voices.onCurrentCharacters("abcd", "answer");
  assert.equal(engine.calls.filter((call) => call[0] === "note").length, 1, "the text beat itself is scheduled");
  now += 100;
  voices.tick();
  assert.equal(pulses().length, 2, "no pulse right after a text beat");
});

test("a waiting session never pulses", () => {
  let now = 0;
  const { engine, voices } = buildVoices({ clock: () => now });
  voices.apply(new Map([["a", { running: true }]]));
  voices.apply(new Map([["a", { running: true, pendingInteraction: { kind: "approval", id: "p1", turnId: "t1" } }]]));
  now = sessions.WORKING_PULSE_IDLE_MS + 500;
  voices.tick();
  assert.equal(engine.calls.filter((call) => call[0] === "pulse").length, 0);
});

test("each phase uses its own density, pitch, and switch", () => {
  const { engine, voices } = buildVoices();
  voices.apply(new Map([["a", { running: true }]]));

  voices.onCurrentCharacters("ab", "thinking");
  voices.onCurrentCharacters("abcd", "answer");
  const notes = engine.calls.filter((call) => call[0] === "note");
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0][3], { charactersPerBeat: settings.DEFAULTS.thinkingDensity, pitch: "normal", phase: "thinking" });
  assert.deepEqual(notes[1][3], { charactersPerBeat: settings.DEFAULTS.answerDensity, pitch: "normal", phase: "answer" });

  const muted = buildVoices({
    settings: { ...settings.DEFAULTS, thinkingSound: false, answerSound: false, toolSound: "off" },
  });
  muted.voices.apply(new Map([["a", { running: true }]]));
  muted.voices.onCurrentCharacters("abcdefgh", "thinking");
  muted.voices.onCurrentCharacters("abcdefgh", "answer");
  assert.equal(muted.engine.calls.filter((call) => call[0] === "note").length, 0);
  // Muted text still counts as activity, so the pulse does not take over.
  let now = 0;
  const clocked = buildVoices({
    clock: () => now,
    settings: { ...settings.DEFAULTS, thinkingSound: false, toolSound: "normal" },
  });
  clocked.voices.apply(new Map([["a", { running: true }]]));
  now = 5000;
  clocked.voices.onCurrentCharacters("abcdefgh", "thinking");
  clocked.voices.tick();
  assert.equal(clocked.engine.calls.filter((call) => call[0] === "pulse").length, 0);
});

test("the tool phase can be silenced, retimed and transposed", () => {
  let now = 0;
  const off = buildVoices({ clock: () => now, settings: { ...settings.DEFAULTS, toolSound: "off" } });
  off.voices.apply(new Map([["a", { running: true }]]));
  now = sessions.WORKING_PULSE_IDLE_MS + 2000;
  off.voices.tick();
  assert.equal(off.engine.calls.filter((call) => call[0] === "pulse").length, 0);

  now = 0;
  const fast = buildVoices({
    clock: () => now,
    settings: { ...settings.DEFAULTS, toolSound: "600", toolPitch: "high" },
  });
  fast.voices.apply(new Map([["a", { running: true }]]));
  now = sessions.WORKING_PULSE_IDLE_MS + 100;
  fast.voices.tick();
  const first = fast.engine.calls.filter((call) => call[0] === "pulse");
  assert.deepEqual(first, [["pulse", "a", { pitch: "high" }]]);
  now += settings.TOOL_PULSE_INTERVALS["600"] - 100;
  fast.voices.tick();
  assert.equal(fast.engine.calls.filter((call) => call[0] === "pulse").length, 1, "the 600 ms rate is respected");
  now += 200;
  fast.voices.tick();
  assert.equal(fast.engine.calls.filter((call) => call[0] === "pulse").length, 2);

  // The fastest step is 100 ms, the same spacing the densest text phase plays
  // at; the scheduler must be quick enough to honour it (it used to tick every
  // 250 ms, which silently capped the rate at four pulses a second).
  now = 0;
  const rapid = buildVoices({ clock: () => now, settings: { ...settings.DEFAULTS, toolSound: "100" } });
  rapid.voices.apply(new Map([["a", { running: true }]]));
  const rapidBeats = () => rapid.engine.calls.filter((call) => call[0] === "pulse").length;
  for (let elapsed = 0; elapsed <= sessions.WORKING_PULSE_IDLE_MS + 800; elapsed += sessions.PULSE_TICK_MS) {
    now = elapsed;
    rapid.voices.tick();
  }
  // ~800 ms of pulsing at 100 ms is eight beats; a 250 ms scheduler yields three.
  assert.ok(rapidBeats() >= 6, `a 100 ms pulse must keep up, got ${rapidBeats()} beats`);

  // Every offered rate is a distinct interval; two very different settings run
  // the pulse at visibly different speeds.
  const slow = buildVoices({ clock: () => now, settings: { ...settings.DEFAULTS, toolSound: "2000" } });
  slow.voices.apply(new Map([["a", { running: true }]]));
  const start = now;
  const beats = () => slow.engine.calls.filter((call) => call[0] === "pulse").length;
  for (let elapsed = start; elapsed <= start + 4000; elapsed += 100) {
    now = elapsed;
    slow.voices.tick();
  }
  assert.ok(beats() >= 1 && beats() <= 2, `a 2 s pulse should ring once or twice in 4 s, got ${beats()}`);
});

// ---------------------------------------------------------------------------
// Density → live tempo
// ---------------------------------------------------------------------------

const musicModule = graph.load("engine");

test("a density maps to one note spacing, shared by the stream and the audition", () => {
  assert.equal(musicModule.densityIntervalMs(1), 100, "the floor keeps a 1-character beat from stacking");
  assert.equal(musicModule.densityIntervalMs(2), 120);
  assert.equal(musicModule.densityIntervalMs(3), 150);
  assert.equal(musicModule.densityIntervalMs(4), 180);
  assert.equal(musicModule.densityIntervalMs(6), 240);
  assert.equal(musicModule.densityIntervalMs(8), 300);
  assert.equal(musicModule.densityIntervalMs(undefined), 180, "an absent density means the default 4 characters per beat");
  assert.equal(musicModule.densityIntervalMs(0), 100);
  assert.equal(musicModule.densityIntervalMs(99), 300);
});

test("the density setting paces the live stream, not just the 试听 phrase", () => {
  // Real streaming delivers several characters per DOM flush, so the character
  // gate alone once left the tempo to the flush cadence: the setting only
  // changed 试听. The stream must now follow it too.
  const rate = (density) => liveNoteRate(density);
  const dense = rate(2);
  const medium = rate(4);
  const sparse = rate(8);
  assert.ok(dense >= 6, `density 2 should be lively, got ${dense.toFixed(1)}/s`);
  assert.ok(medium < dense, `density 4 (${medium.toFixed(1)}/s) must be slower than 2 (${dense.toFixed(1)}/s)`);
  assert.ok(sparse <= 4.5, `density 8 should be sparse, got ${sparse.toFixed(1)}/s`);
  assert.ok(medium > sparse, `density 4 (${medium.toFixed(1)}/s) must be faster than 8 (${sparse.toFixed(1)}/s)`);
});

/** Note rate of a fast text stream at one density, over three seconds. */
function liveNoteRate(density, { chunk = 3, everyMs = 40, durationMs = 3000 } = {}) {
  let now = 0;
  let oscillators = 0;
  const Param = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; return this; },
    linearRampToValueAtTime(value) { this.value = value; return this; },
    exponentialRampToValueAtTime(value) { this.value = value; return this; },
    cancelScheduledValues() { return this; },
  });
  const node = () => ({
    gain: Param(), frequency: Param(), Q: Param(), buffer: null,
    connect() { return this; }, disconnect() {}, start() {}, stop() {},
  });
  class Context {
    constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 48000; this.destination = node(); }
    createGain() { return node(); }
    createOscillator() { oscillators += 1; return node(); }
    createBiquadFilter() { return node(); }
    createConvolver() { return node(); }
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: (channel) => data[channel] };
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  const music = new musicModule.MusicEngine({ bus: new musicModule.AudioBus(Context), clock: () => now });
  const value = { ...settings.DEFAULTS, thinkingDensity: density, answerDensity: density };
  const voices = new sessions.SessionVoices({
    engine: music,
    chimes: { play: async () => true },
    getSettings: () => value,
    getCurrentId: () => "a",
    clock: () => now,
  });
  voices.apply(new Map([["a", { running: true }]]));
  const before = oscillators;
  for (let elapsed = 0; elapsed < durationMs; elapsed += everyMs) {
    voices.onCurrentCharacters("x".repeat(chunk), "thinking");
    now = elapsed + everyMs;
  }
  return (oscillators - before) / (durationMs / 1000);
}

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

test("the walker keeps prose and drops code and whitespace", () => {
  const code = new FakeElement("CODE", { children: [text("const x = 1")] });
  const span = new FakeElement("SPAN", { children: [text("ab c")] });
  const root = new FakeElement("DIV", { children: [span, code, text("\n")] });
  const read = observer.readFlow(root);
  assert.equal(read.text, "abc");
  assert.equal(read.count, 3);
  assert.deepEqual(read.kept, ["a", "b", "c"]);
});

test("the flow root is the nearest data-chat-flow-kind wrapper", () => {
  const outer = new FakeElement("DIV", { attrs: { "data-chat-flow-kind": "assistant-step" } });
  const inner = new FakeElement("SPAN");
  outer.appendChild(inner);
  assert.equal(observer.flowRootOf(inner), outer);
  assert.equal(observer.flowRootOf(new FakeElement("SPAN")), null);
});

test("thinking text is tracked as well as answer prose", () => {
  const thinking = new FakeElement("DIV", {
    attrs: { "data-chat-flow-kind": "assistant-step", "data-chat-group-part": "reasoning" },
  });
  const prose = new FakeElement("DIV", { attrs: { "data-chat-flow-kind": "assistant-step" } });
  const tool = new FakeElement("DIV", { attrs: { "data-chat-flow-kind": "turn-process" } });
  assert.equal(observer.isAnswerRoot(thinking), true);
  assert.equal(observer.isAnswerRoot(prose), true);
  assert.equal(observer.isAnswerRoot(tool), false);
  assert.equal(observer.phaseOf(thinking), "thinking");
  assert.equal(observer.phaseOf(prose), "answer");
});

test("the observer baselines mounted text and reports typed deltas only", () => {
  const body = new FakeElement("BODY");
  const root = new FakeElement("DIV", {
    attrs: { "data-chat-flow-kind": "assistant-step" },
    children: [text("mounted answer that was already here when the page loaded")],
  });
  body.appendChild(root);
  const document = { body, addEventListener() {} };
  const seen = [];
  let notify = () => {};
  class FakeObserver {
    constructor(callback) {
      notify = callback;
    }
    observe() {}
    disconnect() {}
  }
  const instance = new observer.ChatTextObserver({
    onCharacters: (characters) => seen.push(characters.join("")),
    document,
    MutationObserver: FakeObserver,
  });
  instance.start();
  const appended = text("hello");
  root.appendChild(appended);
  notify([{ type: "childList", addedNodes: [appended] }]);
  assert.deepEqual(seen, ["hello"], "an append after the baseline is typing");
  instance.stop();
});

// ---------------------------------------------------------------------------
// Host half: the Loader row
// ---------------------------------------------------------------------------

const hostPlugin = await import("./index.js");

test("the Host half only owns the Loader row", () => {
  assert.equal(typeof hostPlugin.apply, "function");
  assert.equal(hostPlugin.inject, undefined, "the feature needs no Host services");
  const effects = [];
  const ctx = {
    effect: (callback) => {
      effects.push(callback);
      return () => {};
    },
    webServer: {
      register: () => {
        throw new Error("the Host half must not mount an audio route any more");
      },
    },
  };
  assert.equal(hostPlugin.apply(ctx), undefined);
  assert.equal(effects.length, 0);
});

// ---------------------------------------------------------------------------
// The built browser artifact against a fake runtime
// ---------------------------------------------------------------------------

/** Minimal Web Audio stand-ins: enough for the engine to build and drive a graph. */
class FakeParam {
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(value) {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value) {
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  constructor() {
    this.gain = new FakeParam(0);
    this.frequency = new FakeParam(440);
    this.Q = new FakeParam(1);
    this.buffer = null;
    this.onended = null;
  }
  connect() {
    return this;
  }
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.destination = new FakeNode();
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createConvolver() {
    return new FakeNode();
  }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel) => data[channel] };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
  useEffect: () => {},
  useReducer: (_reducer, initial) => [initial, () => {}],
  useCallback: (callback) => callback,
  useRef: (initial) => ({ current: initial }),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};

/** A Cordis client context with just the services this plugin uses. */
function fakeClientContext() {
  const disposers = [];
  const registrations = [];
  const statusListeners = new Set();
  const currentListeners = new Set();
  let status = new Map();
  const ctx = {
    effect: (callback) => {
      const dispose = callback();
      if (typeof dispose === "function") disposers.push(dispose);
      return dispose;
    },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
      subscribe: () => () => {},
    },
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
    uiSession: {
      sessionStatus: {
        getSnapshot: () => status,
        subscribe: (listener) => {
          statusListeners.add(listener);
          return () => statusListeners.delete(listener);
        },
      },
      adapter: {
        current: {
          getSnapshot: () => ({ key: "a" }),
          subscribe: (listener) => {
            currentListeners.add(listener);
            return () => currentListeners.delete(listener);
          },
        },
      },
    },
    configForms: { get: () => undefined },
    get: () => undefined,
  };
  return {
    ctx,
    registrations,
    setStatus(next) {
      status = next;
      for (const listener of statusListeners) listener();
    },
    disposeAll() {
      for (const dispose of disposers.reverse()) dispose();
    },
  };
}

test("the built client module applies cleanly against a fake runtime", () => {
  const saved = {};
  const injected = ["window", "document", "localStorage", "AudioContext"];
  for (const name of injected) saved[name] = globalThis[name];

  const memory = new Map();
  const styleTag = { dataset: {}, textContent: "", remove() {} };
  /** Assigned inside the try so the finally block can always dispose. */
  let runtime;
  try {
    globalThis.window = { __ModuleLoader__: { load: (spec) => (globalThis.__SPEC__ = spec) } };
    globalThis.localStorage = {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, value),
    };
    globalThis.document = {
      hidden: false,
      head: { appendChild() {} },
      body: { querySelectorAll: () => [] },
      querySelector: () => null,
      createElement: () => styleTag,
      addEventListener() {},
      removeEventListener() {},
    };
    globalThis.AudioContext = FakeAudioContext;
    FakeAudioContext.instances.length = 0;

    new Function(readFileSync(target, "utf8"))();
    const spec = globalThis.__SPEC__;
    assert.equal(spec.id, "dsh-coding-sound");
    const module = spec.factory(() => ReactStub);
    assert.deepEqual(module.inject, ["slots", "uiSession", "locale"]);

    runtime = fakeClientContext();
    module.apply(runtime.ctx);
    assert.equal(runtime.registrations.length, 1);
    assert.equal(runtime.registrations[0].options.name, "settings.section");
    assert.equal(runtime.registrations[0].options.id, "coding-sound");
    assert.equal(typeof runtime.registrations[0].component, "function");

    // A session starting opens the shared context; approval pauses its music and
    // rings the attention chime; finishing stops it and schedules completion.
    runtime.setStatus(new Map([["a", { running: true }]]));
    assert.equal(FakeAudioContext.instances.length, 1, "a running session opens the shared context");
    runtime.setStatus(new Map([["a", { running: true, pendingInteraction: { kind: "approval", id: "p1", turnId: "t1" } }]]));
    runtime.setStatus(new Map([["a", { running: true }]]));
    runtime.setStatus(new Map([["a", { running: false }]]));

    // The section renders as a card with the six reference rows and a preview
    // button on every non-off row.
    const collect = (root, predicate) => {
      const found = [];
      const walk = (node) => {
        if (Array.isArray(node)) {
          for (const child of node) walk(child);
          return;
        }
        if (node === null || typeof node !== "object") return;
        // Render the small presentational components (SelectControl,
        // VolumeControl) so their select/slider output is visible to the walker.
        if (typeof node.type === "function") {
          walk(node.type(node.props ?? {}));
          return;
        }
        if (predicate(node)) found.push(node);
        for (const child of node.children ?? []) walk(child);
      };
      walk(root);
      return found;
    };
    const SoundSection = runtime.registrations[0].component;
    const registration = runtime.registrations[0].options;
    const navLabel = registration.label();
    assert.equal(navLabel.props.className, "dcs-nav");
    assert.equal(navLabel.props["data-coding-sound-nav"], "");
    const first = SoundSection({});
    assert.equal(first.props.className, "dcs-stack");
    assert.equal(collect(first, (node) => node.props?.className === "dcs-row").length, 6);
    assert.equal(collect(first, (node) => node.props?.className === "dcs-phase-row").length, 3);
    assert.equal(collect(first, (node) => node.type === "select").length, 9);
    assert.equal(collect(first, (node) => node.props?.role === "switch").length, 3);
    assert.equal(collect(first, (node) => node.props?.className === "dcs-preview").length, 6);
    assert.ok(collect(first, (node) => node.props?.className?.includes("dcs-badge--custom")).length === 1);
    // The tool phase now has the same two controls as the text phases: a rate
    // (six steps plus the switch's off) and a pitch.
    const toolControls = collect(
      first,
      (node) => node.type === "select" && String(node.props?.["aria-label"]).startsWith("phaseTool"),
    );
    assert.equal(toolControls.length, 2);
    const toolRate = toolControls[0];
    assert.equal(toolRate.props.value, "900");
    const toolOptions = toolRate.children[0];
    assert.equal(toolOptions.length, 10);
    assert.deepEqual(
      toolOptions.map((option) => option.props.value),
      ["100", "150", "200", "300", "400", "600", "900", "1200", "1600", "2000"],
    );
    assert.match(toolOptions[0].children[0], /^0\.1 /);
    assert.match(toolOptions[9].children[0], /^2 /);
    assert.equal(toolControls[1].props.value, "normal");

    // Auditioning a phase works even before a session runs.
    const thinkingPreview = collect(
      first,
      (node) => node.props?.className === "dcs-preview" && String(node.props?.["aria-label"]).includes("phaseThinking"),
    );
    assert.equal(thinkingPreview.length, 1);
    thinkingPreview[0].props.onClick();
    assert.equal(FakeAudioContext.instances.length, 1);

    // The tool audition takes the new rate and pitch; a slow rate must not throw.
    const toolPreview = collect(
      first,
      (node) => node.props?.className === "dcs-preview" && String(node.props?.["aria-label"]).startsWith("phaseTool"),
    );
    assert.equal(toolPreview.length, 1);
    toolPreview[0].props.onClick();
    assert.equal(FakeAudioContext.instances.length, 1);

    // Selecting "off" on the three main sound rows hides those preview buttons;
    // the phase previews stay available.
    const mainSelects = collect(first, (node) => node.type === "select" && !String(node.props?.className).includes("--compact"));
    assert.equal(mainSelects.length, 3);
    for (const select of mainSelects) select.props.onChange({ target: { value: "off" } });
    const second = SoundSection({});
    assert.equal(collect(second, (node) => node.props?.className === "dcs-preview").length, 3);
    assert.ok(collect(second, (node) => node.props?.className?.includes("dcs-badge--allOff")).length === 1);

    runtime.disposeAll();
    assert.equal(FakeAudioContext.instances[0].state, "closed");
  } finally {
    try {
      runtime?.disposeAll();
    } catch {
      /* already disposed after a failing assertion */
    }
    delete globalThis.__SPEC__;
    for (const name of injected) {
      if (saved[name] === undefined) delete globalThis[name];
      else globalThis[name] = saved[name];
    }
  }
});
