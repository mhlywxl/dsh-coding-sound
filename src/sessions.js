/**
 * Session state → sound edges, and the per-session music lifecycle.
 *
 * One subscription to `uiSession.sessionStatus` drives everything: which
 * sessions hold a music voice, which voice fades out because its session now
 * waits for the user, and which chimes ring. The pure edge derivation lives in
 * `deriveSessionEdges` so the transitions can be tested without a browser.
 *
 * The reference app has a single session; the multi-session rules here are this
 * plugin's extension:
 *  - every running session holds its own voice, at the current-session volume or
 *    the other-session volume;
 *  - a session that starts waiting for the user loses only its own music, while
 *    the other sessions keep playing;
 *  - the completion chime belongs to the current session only, and a subagent
 *    never rings it.
 */

const { shouldPlayAttentionChimeForEvent, TOOL_PULSE_INTERVALS } = settings;
const { TOKENS_PER_BEAT } = presets;

/** The completion chime waits this long, so a two-step turn never rings twice. */
const SUCCESS_CHIME_DEBOUNCE_MS = 320;

/** A non-current session's ambience: one beat every 700–1100 ms. */
const OTHER_SESSION_PULSE_MIN_MS = 700;
const OTHER_SESSION_PULSE_SPREAD_MS = 400;
/** How often the pulse scheduler wakes up, in milliseconds. */
const PULSE_TICK_MS = 250;

/**
 * The current session's working pulse.
 *
 * Reasoning streams token by token and drives notes on its own; tool execution
 * and long pauses do not produce text at all. Once the current answer has been
 * quiet for {@link WORKING_PULSE_IDLE_MS}, a soft note at the speed selected by
 * the `toolSound` setting keeps "still working" audible — the same idea as the
 * non-current ambience, at the current-session volume and a lower velocity so
 * it reads as a pulse rather than another token.
 */
const WORKING_PULSE_IDLE_MS = 1200;
/** Velocity of a working pulse relative to a text-driven beat. */
const WORKING_PULSE_VELOCITY = 0.55;

const APPROVAL_KINDS = new Set(["approval", "approval_request", "approval-request"]);
const ASK_KINDS = new Set(["ask", "ask_request", "ask-request", "question", "user-question", "user_question"]);

/** First non-empty string among the candidates. */
function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value !== "") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/**
 * A stable identity for one pending interaction.
 *
 * DSH's clients expose the pending interaction entry; its exact shape is owned
 * by the session controller, so the fields are read defensively. `signature`
 * always exists — a stable projection of the interaction's own primitive
 * fields — which keeps reconnect dedupe working even when no explicit prompt id
 * is present.
 */
function pendingIdentity(interaction) {
  if (interaction === undefined || interaction === null) {
    return { kind: undefined, turnId: undefined, promptId: undefined, signature: undefined };
  }
  const source = typeof interaction === "object" ? interaction : { kind: String(interaction) };
  const prompt = source.prompt !== null && typeof source.prompt === "object" ? source.prompt : source;
  const rawKind = firstString(source.kind, source.type, prompt.kind);
  const kind = APPROVAL_KINDS.has(rawKind) ? "approval" : ASK_KINDS.has(rawKind) ? "ask" : rawKind ?? "attention";
  const turnId = firstString(source.turnId, source.turn_id, prompt.turnId, source.turn?.id);
  const explicitId = firstString(prompt.id, source.promptId, source.id, source.callId, prompt.callId);
  return { kind, turnId, promptId: explicitId, signature: stableSignature(source, [kind, turnId, explicitId]) };
}

/** JSON of an object's own primitive fields, sorted, so the same prompt hashes alike. */
function stableSignature(source, knownParts) {
  const parts = knownParts.filter((part) => part !== undefined);
  for (const key of Object.keys(source).sort()) {
    if (key === "prompt" || key === "turn") continue;
    const value = source[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.length > 0 ? parts.join("|") : "pending";
}

/** Normalize one `sessionStatus` entry. */
function normalizeEntry(entry) {
  const pending = entry?.pendingInteraction;
  return {
    running: entry?.running === true,
    pending: pending !== undefined && pending !== null,
    pendingKey: pendingIdentity(pending),
  };
}

/** Normalize the whole `sessionStatus` map. */
function normalizeSessions(snapshot) {
  const next = new Map();
  if (snapshot === null || snapshot === undefined || typeof snapshot.forEach !== "function") return next;
  snapshot.forEach((entry, id) => {
    next.set(String(id), normalizeEntry(entry));
  });
  return next;
}

/**
 * Report the edges between two normalized status maps.
 *
 * A session missing from `next` (a closed or unretained session) counts as
 * neither running nor waiting, so its voice and its pending music are cleaned
 * up rather than leaked.
 */
function deriveSessionEdges(previous, next) {
  const started = [];
  const stopped = [];
  const pendingStarted = [];
  const pendingEnded = [];
  for (const [id, state] of next) {
    const before = previous.get(id);
    if (state.running && before?.running !== true) started.push(id);
    if (!state.running && before?.running === true) stopped.push(id);
    if (state.pending && before?.pending !== true) pendingStarted.push(id);
    if (!state.pending && before?.pending === true) pendingEnded.push(id);
  }
  for (const [id, state] of previous) {
    if (next.has(id)) continue;
    if (state.running) stopped.push(id);
    if (state.pending) pendingEnded.push(id);
  }
  return { started, stopped, pendingStarted, pendingEnded };
}

/**
 * Turns session-status edges into voices, fades and chimes.
 *
 * The class owns no subscription itself: `apply()` receives snapshots, which
 * keeps it testable and lets the client own the Cordis effect.
 */
class SessionVoices {
  /**
   * @param {object} options
   * @param {{startVoice: Function, stopVoice: Function, pauseVoice: Function, resumeVoice: Function, setVolume: Function, note: Function}} options.engine
   * @param {{play: (kind: "success"|"attention", settings: object) => Promise<boolean>}} options.chimes
   * @param {() => ReturnType<typeof import("./settings.js").normalizeSettings>} options.getSettings
   * @param {() => string | undefined} options.getCurrentId
   * @param {(sessionId: string) => boolean} [options.isSubagent]
   * @param {() => number} [options.clock]
   * @param {() => number} [options.random]
   * @param {number} [options.successDebounceMs] overridable for tests
   */
  constructor(options) {
    this.engine = options.engine;
    this.chimes = options.chimes;
    this.getSettings = options.getSettings;
    this.getCurrentId = options.getCurrentId;
    this.isSubagent = options.isSubagent ?? (() => false);
    this.clock = options.clock ?? (() => performance.now());
    this.random = options.random ?? Math.random;
    this.successDebounceMs = options.successDebounceMs ?? SUCCESS_CHIME_DEBOUNCE_MS;

    /** @type {Map<string, ReturnType<typeof normalizeEntry>>} */
    this.states = new Map();
    this.baselined = false;
    /** Attention prompts already announced; bounded by the settings helper. */
    this.seenAttention = new Set();
    /** @type {Map<string, number>} last ambience beat per non-current session */
    this.lastPulse = new Map();
    /** Wall-clock time of the last text beat in the current conversation. */
    this.lastCurrentActivity = 0;
    /** @type {Map<string, number>} last working pulse per session */
    this.lastWorkingPulse = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>>} completion debounce timers */
    this.successTimers = new Map();
    this.pulseTimer = null;
    this.disposed = false;
  }

  /** Feed one `sessionStatus` snapshot. */
  apply(snapshot) {
    const next = normalizeSessions(snapshot);
    if (!this.baselined) {
      // Opening the page while sessions already run (or already wait) is not a
      // transition: start their voices, but do not ring a chime for old news.
      this.baselined = true;
      this.states = next;
      this.lastCurrentActivity = this.clock();
      for (const [id, state] of next) this.#syncVoice(id, state);
      this.#pulse();
      return { started: [], stopped: [], pendingStarted: [], pendingEnded: [] };
    }

    const edges = deriveSessionEdges(this.states, next);
    this.states = next;

    for (const id of edges.started) {
      this.#syncVoice(id, next.get(id));
      // A fresh turn on screen: give it the full idle window before a pulse.
      if (id === this.getCurrentId()) this.lastCurrentActivity = this.clock();
    }

    for (const id of edges.stopped) {
      this.engine.stopVoice(id);
      this.lastPulse.delete(id);
      this.lastWorkingPulse.delete(id);
      this.#scheduleSuccessChime(id);
    }

    for (const id of edges.pendingStarted) {
      this.engine.pauseVoice(id);
      this.lastPulse.delete(id);
      this.lastWorkingPulse.delete(id);
      this.#ringAttentionChime(id);
    }

    for (const id of edges.pendingEnded) {
      const state = next.get(id);
      if (state?.running) {
        this.engine.resumeVoice(id);
        if (id === this.getCurrentId()) this.lastCurrentActivity = this.clock();
      }
    }

    this.#pulse();
    return edges;
  }

  /** Re-point the current-session volume after the user switches tabs. */
  setCurrent() {
    for (const [id, state] of this.states) {
      if (state.running) this.engine.setVolume(id, this.#volumeFor(id));
    }
    // Switching conversations is not "the current answer went quiet": start its
    // idle window from now.
    this.lastCurrentActivity = this.clock();
    this.#pulse();
  }

  /**
   * Reconcile every voice with its session after a preset change: turning the
   * music back on must recreate the voices the `off` preset tore down.
   */
  resync() {
    for (const [id, state] of this.states) this.#syncVoice(id, state);
  }

  /**
   * Characters that appeared in the current conversation; drives its beats.
   *
   * The observer labels each delta with its phase. Thinking and answer prose
   * each have their own density, pitch, and on/off switch; a muted phase still
   * counts as activity, so the tool/idle pulse does not fill a stream the user
   * deliberately silenced.
   */
  onCurrentCharacters(characters, phase = "answer") {
    if (this.disposed || characters.length === 0) return;
    const id = this.getCurrentId();
    if (id === undefined) return;
    const state = this.states.get(id);
    if (state === undefined || !state.running || state.pending) return;
    this.lastCurrentActivity = this.clock();
    const settingsValue = this.getSettings();
    const thinking = phase === "thinking";
    const audible = thinking ? settingsValue.thinkingSound : settingsValue.answerSound;
    if (!audible) return;
    this.engine.note(id, characters.length, {
      charactersPerBeat: thinking ? settingsValue.thinkingDensity : settingsValue.answerDensity,
      pitch: thinking ? settingsValue.thinkingPitch : settingsValue.answerPitch,
      phase,
    });
  }

  /** Start the ambience scheduler; `setInterval` is cleared by `dispose`. */
  startPulseScheduler() {
    if (this.pulseTimer !== null) return;
    this.pulseTimer = setInterval(() => this.#pulse(), PULSE_TICK_MS);
  }

  /** Run one ambience pass now (the scheduler calls this; tests call it directly). */
  tick() {
    this.#pulse();
  }

  /** Every scheduled resource this controller owns. */
  dispose() {
    this.disposed = true;
    if (this.pulseTimer !== null) clearInterval(this.pulseTimer);
    this.pulseTimer = null;
    for (const timer of this.successTimers.values()) clearTimeout(timer);
    this.successTimers.clear();
    this.lastPulse.clear();
    this.lastWorkingPulse.clear();
    this.seenAttention.clear();
    this.states.clear();
  }

  #volumeFor(sessionId) {
    const settingsValue = this.getSettings();
    const percentage = sessionId === this.getCurrentId() ? settingsValue.musicVolumeCurrent : settingsValue.musicVolumeOther;
    return Math.max(0, Math.min(1, percentage / 100));
  }

  /** Bring one voice in line with its session's state, or leave it alone. */
  #syncVoice(sessionId, state) {
    if (state === undefined) return;
    if (!state.running) {
      this.engine.stopVoice(sessionId);
      return;
    }
    this.engine.startVoice(sessionId, this.#volumeFor(sessionId));
    // A session may already be waiting when its voice is created (a page opened
    // onto a pending approval): the voice exists, but silently.
    if (state.pending) this.engine.pauseVoice(sessionId);
  }

  /** Completion chime: current session only, debounced, never for a subagent. */
  #scheduleSuccessChime(sessionId) {
    if (sessionId !== this.getCurrentId()) return;
    if (this.isSubagent(sessionId)) return;
    const existing = this.successTimers.get(sessionId);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.successTimers.delete(sessionId);
      const state = this.states.get(sessionId);
      if (state?.running) return;
      void this.chimes.play("success", this.getSettings());
    }, this.successDebounceMs);
    this.successTimers.set(sessionId, timer);
  }

  /** Attention chime: any session, once per prompt identity. */
  #ringAttentionChime(sessionId) {
    const state = this.states.get(sessionId);
    if (state === undefined) return;
    const identity = state.pendingKey;
    if (identity === undefined || identity.signature === undefined) return;
    const event = {
      kind: identity.kind === "approval" || identity.kind === "ask" ? identity.kind : "attention",
      turnId: identity.turnId,
      // A prompt id alone can be reissued by a rebuilt controller; the fallback
      // signature is namespaced by session so two sessions cannot collide.
      promptId: identity.promptId ?? `${sessionId}:${identity.signature}`,
    };
    if (!shouldPlayAttentionChimeForEvent(event, this.seenAttention)) return;
    void this.chimes.play("attention", this.getSettings());
  }

  /**
   * Ambience for sessions the token stream cannot reach.
   *
   * The current conversation is token-driven while text arrives, then falls back
   * to a soft working pulse after {@link WORKING_PULSE_IDLE_MS} of quiet — that
   * is what keeps reasoning pauses, tool execution and long waits audible.
   * Background sessions have no DOM of their own, so they always use a slower
   * pulse on the other-session volume until the user opens them.
   */
  #pulse() {
    if (this.disposed) return;
    const now = this.clock();
    const current = this.getCurrentId();
    for (const [id, state] of this.states) {
      if (!state.running || state.pending) {
        this.lastPulse.delete(id);
        this.lastWorkingPulse.delete(id);
        continue;
      }
      if (id === current) {
        // `toolSound` is the phase's own switch: `off` removes the speed, which
        // silences the pulse entirely.
        const interval = TOOL_PULSE_INTERVALS[this.getSettings().toolSound];
        if (interval === undefined) continue;
        if (now - this.lastCurrentActivity < WORKING_PULSE_IDLE_MS) continue;
        const lastPulse = this.lastWorkingPulse.get(id);
        if (lastPulse !== undefined && now - lastPulse < interval) continue;
        this.lastWorkingPulse.set(id, now);
        this.engine.pulse(id, { velocity: WORKING_PULSE_VELOCITY });
        continue;
      }
      const last = this.lastPulse.get(id);
      const gap = OTHER_SESSION_PULSE_MIN_MS + this.random() * OTHER_SESSION_PULSE_SPREAD_MS;
      if (last !== undefined && now - last < gap) continue;
      if (last === undefined) {
        this.lastPulse.set(id, now);
        continue;
      }
      this.lastPulse.set(id, now);
      this.engine.note(id, TOKENS_PER_BEAT);
    }
  }
}

module.exports = {
  SUCCESS_CHIME_DEBOUNCE_MS,
  OTHER_SESSION_PULSE_MIN_MS,
  OTHER_SESSION_PULSE_SPREAD_MS,
  PULSE_TICK_MS,
  WORKING_PULSE_IDLE_MS,
  WORKING_PULSE_VELOCITY,
  pendingIdentity,
  stableSignature,
  normalizeEntry,
  normalizeSessions,
  deriveSessionEdges,
  SessionVoices,
};
