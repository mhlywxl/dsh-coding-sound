/**
 * The plugin body: build the page's sound runtime (audio bus, music engine,
 * chime player, session voices, transcript observer), wire `uiSession` state to
 * sound, and register the Settings section. Every resource is created inside a
 * `ctx.effect` so unload/HMR disposes it.
 */

/** `localStorage`, or null in a browser that refuses it. */
function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The Host settings-form handle for this plugin, when a Config row exists. */
function configFormHandle(ctx) {
  try {
    const forms = ctx.configForms;
    if (forms === null || forms === undefined || typeof forms.get !== "function") return undefined;
    return forms.get(SETTINGS_SCOPE);
  } catch {
    return undefined;
  }
}

/**
 * Plugin body: build the runtime, wire session state to sound, and register the
 * Settings section.
 * @param {import('@deepseek-ai/cordis').Context} ctx client root context.
 */
function apply(ctx) {
  const document = globalThis.document;
  const bus = new AudioBus();
  const host = configFormHandle(ctx);
  const store = new SettingsStore(safeStorage(), host?.getSnapshot?.()?.value);
  const music = new MusicEngine({ bus });
  const player = new ChimePlayer({ bus });

  /** The session whose conversation is on screen, if any. */
  const getCurrentId = () => {
    try {
      return ctx.uiSession.adapter.current.getSnapshot()?.key;
    } catch {
      return undefined;
    }
  };

  const sessionsService = typeof ctx.get === "function" ? ctx.get("sessions") : undefined;
  /** A delegated child session: it may play music, but never rings completion. */
  const isSubagent = (sessionId) => {
    try {
      const binding = sessionsService?.binding?.(sessionId);
      const snapshot = binding?.session?.getSnapshot?.();
      return snapshot !== undefined && snapshot.subagent !== null && snapshot.subagent !== undefined;
    } catch {
      return false;
    }
  };

  const voices = new SessionVoices({
    engine: music,
    chimes: player,
    getSettings: () => store.get(),
    getCurrentId,
    isSubagent,
  });
  const observer = new ChatTextObserver({
    onCharacters: (characters, phase) => voices.onCurrentCharacters(characters, phase),
  });

  music.setPreset(store.get().musicPreset);
  const styleTag = ensureStyles(document);
  ctx.effect(() => () => styleTag?.remove(), "coding-sound: styles");

  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), "coding-sound: dictionaries");
  const t = ctx.locale.bind(SETTINGS_NS);
  const subscribeLocale = (listener) => ctx.locale.subscribe(listener);

  // Settings → engine. A preset change rebuilds the chain and reconciles voices;
  // a volume change only re-points the per-session gains. Both are live: the
  // engine reads the store's current value, so a slider drag is heard at once.
  let lastPreset = store.get().musicPreset;
  ctx.effect(
    () =>
      store.subscribe(() => {
        const next = store.get();
        if (next.musicPreset !== lastPreset) {
          music.setPreset(next.musicPreset);
          lastPreset = next.musicPreset;
          voices.resync();
        }
        voices.reapplyVolumes();
      }),
    "coding-sound: settings to engine",
  );

  const unlock = () => {
    try {
      bus.context();
    } catch {
      return;
    }
    void bus.resume();
  };
  const onVisibility = () => {
    if (document?.hidden !== true) void bus.resume();
  };

  const SoundSection = createSoundSection({
    store,
    t,
    subscribeLocale,
    audioAvailable: bus.available(),
    previewMusic: (preset) => {
      if (preset === "off") return;
      void bus.resume();
      // 试听 follows the current-session volume, so the slider is audible here
      // too instead of the preview always playing at its own fixed level.
      music.preview(preset, store.get().musicVolumeCurrent / 100);
    },
    previewChime: (kind) => {
      void bus.resume();
      void player.play(kind, store.get());
    },
    previewNotificationVolume: () => {
      void bus.resume();
      const settingsValue = store.get();
      // A volume audition should still sound when both chimes are switched off;
      // fall back to the synth phrase in that case so the slider always gives
      // feedback. Otherwise it plays the completion chime the user selected.
      const sample = settingsValue.successSound === "off" ? { ...settingsValue, successSound: "synth" } : settingsValue;
      void player.play("success", sample);
    },
    previewPhase: (phase) => {
      const settingsValue = store.get();
      void bus.resume();
      const volume = settingsValue.musicVolumeCurrent / 100;
      // The audition is paced by the same interval the live stream uses, so it
      // predicts what the setting will actually sound like during a turn.
      if (phase === "thinking") {
        if (!settingsValue.thinkingSound) return;
        music.previewPhrase({ pitch: settingsValue.thinkingPitch, density: settingsValue.thinkingDensity, count: 4, volume });
        return;
      }
      if (phase === "answer") {
        if (!settingsValue.answerSound) return;
        music.previewPhrase({ pitch: settingsValue.answerPitch, density: settingsValue.answerDensity, count: 4, volume });
        return;
      }
      const interval = TOOL_PULSE_INTERVALS[settingsValue.toolSound];
      if (interval === undefined) return;
      const count = toolPreviewNotes(interval);
      // Preview the jittered gaps, so the audition sounds like the live phase.
      const intervals = settingsValue.toolRandom
        ? Array.from({ length: count - 1 }, () => toolPulseGap(interval, Math.random))
        : undefined;
      music.previewPhrase({
        count,
        intervalMs: interval,
        intervals,
        pitch: settingsValue.toolPitch,
        volume,
      });
    },
  });

  ctx.effect(
    () =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: SECTION_ID,
            order: SECTION_ORDER,
            // The host maps nav icons by section id and falls back to a gear for
            // unknown ids, so the speaker glyph travels inside the label here and
            // the stylesheet hides that fallback gear for this row only.
            label: () =>
              h(
                "span",
                { className: "dcs-nav", "data-coding-sound-nav": "" },
                h("span", { className: "dcs-nav-icon", "aria-hidden": true }, speakerIcon()),
                h("span", { className: "dcs-nav-text" }, t("nav")),
              ),
          },
          SoundSection,
        ),
      ),
    "coding-sound: settings section",
  );

  // The audio graph may only start inside a gesture; opening the context there
  // (rather than at the first note) is what keeps the first beat audible.
  document?.addEventListener("pointerdown", unlock, { capture: true });
  document?.addEventListener("keydown", unlock, { capture: true });
  document?.addEventListener("visibilitychange", onVisibility);

  observer.start();
  voices.startPulseScheduler();

  const statusSource = ctx.uiSession.sessionStatus;
  const currentSource = ctx.uiSession.adapter.current;
  const stopStatus = statusSource.subscribe(() => voices.apply(statusSource.getSnapshot()));
  const stopCurrent = currentSource.subscribe(() => {
    voices.setCurrent();
    observer.reset();
    void bus.resume();
  });
  voices.apply(statusSource.getSnapshot());

  // The Host Config is the base layer when a row carries one; the browser's own
  // document always wins over it. Watching it keeps a Host-side edit effective
  // without a reload.
  let stopHost;
  if (host !== undefined && typeof host.subscribe === "function") {
    stopHost = host.subscribe(() => store.setHostDefaults(host.getSnapshot()?.value));
  }

  ctx.effect(
    () => () => {
      stopStatus();
      stopCurrent();
      stopHost?.();
      observer.stop();
      voices.dispose();
      music.dispose();
      bus.dispose();
      document?.removeEventListener("pointerdown", unlock, { capture: true });
      document?.removeEventListener("keydown", unlock, { capture: true });
      document?.removeEventListener("visibilitychange", onVisibility);
    },
    "coding-sound: runtime",
  );

  if (!bus.available()) {
    // No Web Audio (a locked-down WebView): the Settings section still renders,
    // and previewing is simply silent. Nothing else in the page changes.
    console.warn(`[${PACKAGE_ID}] Web Audio is unavailable in this browser; sound stays off`);
  }
}

return {
  inject: ["slots", "uiSession", "locale"],
  apply,
  __test,
};
