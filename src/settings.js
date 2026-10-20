/**
 * Persisted sound settings for the coding-sound plugin.
 *
 * The values belong to the browser that plays the sound, not to the DSH
 * profile: two browsers on the same profile keep independent sound settings,
 * and a slider applies immediately instead of waiting for a Host round trip.
 * They live as one plain-JSON document in `localStorage`, and every read is
 * hardened — a stale or hand-edited value must never break the chat.
 *
 * Host values (future plugin `Config`) are accepted as a base layer: a
 * browser-local key wins when it is present, everything else falls back to the
 * Host value and finally to {@link DEFAULTS}.
 */

const { PRESET_IDS } = presets;

/** One document key, versioned so a later format change can migrate. */
const STORAGE_KEY = "dsh:coding-sound:v1";
/** Whether the card is expanded; the reference keeps it in memory, we persist it. */
const EXPANDED_KEY = "dsh:coding-sound:expanded";

/** The chime choices, in the dropdown's order. */
const SOUND_PREF_IDS = ["off", "synth", "positive", "correct", "start", "back"];

/** Pitch choices for the thinking, answer and tool phases. */
const PITCH_IDS = ["low", "normal", "high"];
/** Per-phase beat densities offered by the card, in characters per note. */
const DENSITY_VALUES = [1, 2, 3, 4, 6, 8];
/**
 * Tool/idle pulse rates, in milliseconds between pulses. `off` silences the
 * phase. Ten steps instead of the old 慢/标准/快, from the fastest text beat
 * (100 ms, which is what `density = 1` plays) up to a once-every-2-seconds
 * heartbeat, and a separate pitch transposes it.
 */
const TOOL_PULSE_INTERVALS = Object.freeze({
  100: 100,
  150: 150,
  200: 200,
  300: 300,
  400: 400,
  600: 600,
  900: 900,
  1200: 1200,
  1600: 1600,
  2000: 2000,
});
/** Values the tool-sound dropdown offers: every interval, plus `off`. */
const TOOL_SPEED_IDS = ["off", ...Object.keys(TOOL_PULSE_INTERVALS)];
/**
 * Stored values written by the three-step card (慢/标准/快). They keep working:
 * the same setting is adopted at its nearest new step instead of being reset.
 */
const LEGACY_TOOL_SPEED_IDS = Object.freeze({ slow: "1200", normal: "900", fast: "600" });

/** Every persisted field, in a stable order. */
const SETTINGS_KEYS = [
  "musicPreset",
  "notifyVolume",
  "successSound",
  "attentionSound",
  "musicVolumeCurrent",
  "musicVolumeOther",
  "thinkingSound",
  "thinkingDensity",
  "thinkingPitch",
  "answerSound",
  "answerDensity",
  "answerPitch",
  "toolSound",
  "toolRandom",
  "toolPitch",
];

/**
 * First-run values. A freshly installed plugin is audible — the user installed
 * a sound plugin — with the notification chimes at full volume and the
 * non-current session layer at 80%.
 *
 * Thinking is denser than the answer (one note per 2 reasoning characters) so a
 * long reasoning stream reads as continuous music rather than a slow pulse; the
 * user can change or disable each phase in the settings card.
 */
const DEFAULTS = Object.freeze({
  musicPreset: "digital",
  notifyVolume: 100,
  successSound: "synth",
  attentionSound: "synth",
  musicVolumeCurrent: 100,
  musicVolumeOther: 80,
  thinkingSound: true,
  thinkingDensity: 2,
  thinkingPitch: "normal",
  answerSound: true,
  answerDensity: 4,
  answerPitch: "normal",
  toolSound: "900",
  toolRandom: true,
  toolPitch: "normal",
});

/** Volume floor/ceiling and slider step for both kinds of volume. */
const VOLUME_MIN = 0;
const VOLUME_MAX = 100;
const VOLUME_STEP = 5;

/**
 * Relative loudness of the four named chime options.
 *
 * The four WAV samples differed by up to 4.1 LUFS; the plugin used to trim them
 * to the quietest source so switching options never jumped in volume. The WAVs
 * are gone (the options are synthesized now), but the same ratios are kept so
 * the four options still sit at the loudness users heard from the samples.
 */
const CHIME_VARIANT_LEVEL = Object.freeze({
  positive: 0.62,
  correct: 0.85,
  start: 1,
  back: 0.7,
});

const PRESET_SET = new Set(PRESET_IDS);
const SOUND_SET = new Set(SOUND_PREF_IDS);
const PITCH_SET = new Set(PITCH_IDS);
const TOOL_SPEED_SET = new Set(TOOL_SPEED_IDS);

/** A stored preset that is no longer offered falls back to the default. */
function normalizePreset(value, fallback) {
  return PRESET_SET.has(value) ? value : fallback;
}

/** A stored chime that is no longer offered falls back to the default. */
function normalizeSound(value, fallback) {
  return SOUND_SET.has(value) ? value : fallback;
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

/** A phase pitch, falling back to the default. */
function normalizePitch(value, fallback) {
  return PITCH_SET.has(value) ? value : fallback;
}

/** A tool pulse rate, accepting the 慢/标准/快 values written by older cards. */
function normalizeToolSpeed(value, fallback) {
  const legacy = LEGACY_TOOL_SPEED_IDS[value];
  const id = legacy !== undefined ? legacy : value;
  return TOOL_SPEED_SET.has(id) ? id : fallback;
}

/** Characters per beat, clamped to the offered 1–8 range. */
function normalizeDensity(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(8, Math.max(1, Math.round(numeric)));
}

/** Clamp one notification volume to 0–100, rounding to the stored integer. */
function normalizeNotificationVolume(value, fallback = DEFAULTS.notifyVolume) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "" || raw === null || raw === undefined) return fallback;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Math.round(numeric)));
}

/** Clamp one music/session volume to 0–100. */
function normalizeMusicVolume(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Math.round(numeric)));
}

/** Every field clamped and validated; never throws. */
function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === "object" ? raw : {};
  return {
    musicPreset: normalizePreset(source.musicPreset, DEFAULTS.musicPreset),
    notifyVolume: normalizeNotificationVolume(source.notifyVolume, DEFAULTS.notifyVolume),
    successSound: normalizeSound(source.successSound, DEFAULTS.successSound),
    attentionSound: normalizeSound(source.attentionSound, DEFAULTS.attentionSound),
    musicVolumeCurrent: normalizeMusicVolume(source.musicVolumeCurrent, DEFAULTS.musicVolumeCurrent),
    musicVolumeOther: normalizeMusicVolume(source.musicVolumeOther, DEFAULTS.musicVolumeOther),
    thinkingSound: bool(source.thinkingSound, DEFAULTS.thinkingSound),
    thinkingDensity: normalizeDensity(source.thinkingDensity, DEFAULTS.thinkingDensity),
    thinkingPitch: normalizePitch(source.thinkingPitch, DEFAULTS.thinkingPitch),
    answerSound: bool(source.answerSound, DEFAULTS.answerSound),
    answerDensity: normalizeDensity(source.answerDensity, DEFAULTS.answerDensity),
    answerPitch: normalizePitch(source.answerPitch, DEFAULTS.answerPitch),
    toolSound: normalizeToolSpeed(source.toolSound, DEFAULTS.toolSound),
    toolRandom: bool(source.toolRandom, DEFAULTS.toolRandom),
    toolPitch: normalizePitch(source.toolPitch, DEFAULTS.toolPitch),
  };
}

/**
 * Effective settings for this browser: browser-local keys win over the Host
 * document, field by field; a field neither layer carries keeps its default.
 */
function resolveSettings(hostDefaults, localOverrides) {
  const base = normalizeSettings(hostDefaults);
  const overrides = localOverrides !== null && typeof localOverrides === "object" ? localOverrides : {};
  const merged = { ...base };
  for (const key of SETTINGS_KEYS) {
    if (Object.hasOwn(overrides, key) && overrides[key] !== undefined) merged[key] = overrides[key];
  }
  return normalizeSettings(merged);
}

/**
 * The card's three-state badge, copied from the reference `summarizeSoundStatus`:
 * count the audible layers; 0 = all off, 1 = enabled, 2–3 = customized.
 */
function summarizeSoundStatus(music, success, attention, notificationVolume) {
  const notificationsAudible = notificationVolume > 0;
  const count = [
    music !== "off",
    notificationsAudible && success !== "off",
    notificationsAudible && attention !== "off",
  ].filter(Boolean).length;
  if (count === 0) return "allOff";
  if (count === 1) return "enabled";
  return "custom";
}

/** Notification volume (0–100) as a linear gain. */
function notificationVolumeToGain(volume) {
  return normalizeNotificationVolume(volume) / VOLUME_MAX;
}

/** Output gain for one named chime option: notification volume × its level. */
function chimeVariantLevel(preference, outputVolume) {
  const level = CHIME_VARIANT_LEVEL[preference];
  if (level === undefined) return 0;
  const volume = Number.isFinite(outputVolume) ? Math.min(1, Math.max(0, outputVolume)) : 0;
  return volume * level;
}

/** Whether the completion chime is audible under these settings. */
function successChimeAudible(settings) {
  return settings.successSound !== "off" && settings.notifyVolume > 0;
}

/** Whether the attention chime is audible under these settings. */
function attentionChimeAudible(settings) {
  return settings.attentionSound !== "off" && settings.notifyVolume > 0;
}

/**
 * Dedupe key for one attention chime.
 *
 * Approval and ask prompts are re-delivered after a reconnect or a session
 * replay, so "a prompt appeared" is not the same as "the user has not been
 * told yet". The key is the prompt's own identity: turn ids are stable across
 * detach/reattach, while a prompt id alone could be reissued by a rebuilt
 * controller.
 *
 * @param {{kind?: string, turnId?: string, promptId?: string, hostId?: string, tabId?: string}} event
 * @returns {string | undefined} undefined when the event carries no identity.
 */
function attentionChimeEventKey(event) {
  if (event === null || typeof event !== "object") return undefined;
  const kind = event.kind === "approval" ? "approval" : event.kind === "ask" ? "ask" : undefined;
  if (kind === undefined) return undefined;
  const promptId = event.promptId;
  if (promptId === undefined || promptId === null || String(promptId) === "") return undefined;
  const turnId = event.turnId;
  const identity = [kind, turnId ?? "", String(promptId)];
  if (event.hostId !== undefined && event.hostId !== "" && event.hostId !== "local") identity.push(event.hostId);
  return turnId ? `turn:${JSON.stringify(identity)}` : `${kind}:${event.tabId ?? ""}:${promptId}`;
}

/** Bounded seen-set: prompt ids are unique, so the set would only grow. */
const ATTENTION_CHIME_SEEN_CAP = 512;

/**
 * Remember one prompt identity and report whether its chime should play.
 * Past the cap the oldest half is dropped (insertion order), which still covers
 * everything a reconnect can replay.
 */
function shouldPlayAttentionChimeForEvent(event, seen) {
  const key = attentionChimeEventKey(event);
  if (key === undefined || seen.has(key)) return false;
  if (seen.size >= ATTENTION_CHIME_SEEN_CAP) {
    let drop = seen.size - ATTENTION_CHIME_SEEN_CAP / 2;
    for (const stale of seen) {
      if (drop-- <= 0) break;
      seen.delete(stale);
    }
  }
  seen.add(key);
  return true;
}

/**
 * Drop view-scoped keys after a runtime rebuild, keeping turn-scoped ones: the
 * ids of a rebuilt controller restart from 1 and would collide, while turn ids
 * must keep suppressing a replay.
 */
function clearAttentionChimeKeys(seen, tabId) {
  if (tabId === undefined || tabId === "") {
    for (const key of seen) if (!key.startsWith("turn:")) seen.delete(key);
    return;
  }
  for (const key of [...seen]) {
    if (key.startsWith(`approval:${tabId}:`) || key.startsWith(`ask:${tabId}:`)) seen.delete(key);
  }
}

/**
 * Settings facade over `localStorage`.
 *
 * One snapshot object is published per change so React can subscribe with
 * `useSyncExternalStore`; a browser without `localStorage` (private mode, a
 * locked-down WebView) still gets working in-memory defaults.
 */
class SettingsStore {
  /**
   * @param {Storage | null | undefined} storage
   * @param {object | undefined} hostDefaults Host Config document, when one exists
   */
  constructor(storage, hostDefaults) {
    this.storage = storage ?? null;
    this.hostDefaults = hostDefaults;
    this.listeners = new Set();
    /** @type {Record<string, unknown>} only the keys this browser chose */
    this.local = this.#readLocal();
    /** @type {ReturnType<typeof normalizeSettings>} */
    this.value = resolveSettings(this.hostDefaults, this.local);
    this.expanded = this.#readExpanded();
    this.snapshot = Object.freeze({ settings: this.value, expanded: this.expanded });
  }

  #readLocal() {
    try {
      const stored = this.storage?.getItem(STORAGE_KEY);
      if (stored === null || stored === undefined) return {};
      const parsed = JSON.parse(stored);
      return parsed !== null && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  #readExpanded() {
    try {
      const stored = this.storage?.getItem(EXPANDED_KEY);
      return stored === null || stored === undefined ? true : stored === "1";
    } catch {
      return true;
    }
  }

  get() {
    return this.value;
  }

  getSnapshot() {
    return this.snapshot;
  }

  isExpanded() {
    return this.expanded;
  }

  #publish() {
    this.snapshot = Object.freeze({ settings: this.value, expanded: this.expanded });
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }

  /**
   * Merge a patch into this browser's overrides, persist it, and notify
   * subscribers. Only the keys actually written are stored, so a later change
   * to the Host defaults still reaches fields this browser never touched.
   * @param {Partial<ReturnType<typeof normalizeSettings>>} patch
   */
  set(patch) {
    if (patch !== null && typeof patch === "object") {
      for (const key of SETTINGS_KEYS) {
        if (Object.hasOwn(patch, key) && patch[key] !== undefined) this.local[key] = patch[key];
      }
    }
    this.value = resolveSettings(this.hostDefaults, this.local);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.local));
    } catch {
      /* private mode or a full quota: the in-memory value already changed */
    }
    this.#publish();
    return this.value;
  }

  /** Adopt (or replace) the Host Config document as the base layer. */
  setHostDefaults(hostDefaults) {
    this.hostDefaults = hostDefaults;
    this.value = resolveSettings(hostDefaults, this.local);
    this.#publish();
    return this.value;
  }

  /** Persist the card's open/closed state. */
  setExpanded(expanded) {
    this.expanded = expanded === true;
    try {
      this.storage?.setItem(EXPANDED_KEY, this.expanded ? "1" : "0");
    } catch {
      /* same fallback as above */
    }
    this.#publish();
    return this.expanded;
  }

  /** @param {(snapshot: {settings: typeof DEFAULTS, expanded: boolean}) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

module.exports = {
  STORAGE_KEY,
  EXPANDED_KEY,
  SETTINGS_KEYS,
  SOUND_PREF_IDS,
  PITCH_IDS,
  DENSITY_VALUES,
  TOOL_SPEED_IDS,
  TOOL_PULSE_INTERVALS,
  LEGACY_TOOL_SPEED_IDS,
  DEFAULTS,
  VOLUME_MIN,
  VOLUME_MAX,
  VOLUME_STEP,
  CHIME_VARIANT_LEVEL,
  ATTENTION_CHIME_SEEN_CAP,
  normalizeSettings,
  normalizeNotificationVolume,
  normalizeMusicVolume,
  resolveSettings,
  summarizeSoundStatus,
  notificationVolumeToGain,
  chimeVariantLevel,
  successChimeAudible,
  attentionChimeAudible,
  attentionChimeEventKey,
  shouldPlayAttentionChimeForEvent,
  clearAttentionChimeKeys,
  SettingsStore,
};
