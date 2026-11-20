/**
 * The "声音与提醒" Settings section: one grouped music/notification card plus the
 * phase card, and the small presentational controls both use. It renders with
 * the host's theme tokens and reads/writes the store from `settings.js`.
 */

/**
 * How many notes a tool audition plays at one pulse rate: slow rates get two,
 * so a 2 s setting does not turn one click into a six-second phrase.
 */
function toolPreviewNotes(intervalMs) {
  return intervalMs >= 1200 ? 2 : 3;
}

/** The tool audition's disable window, derived from the selected pulse rate. */
function toolAuditionLockMs(toolSound, random = true) {
  const interval = TOOL_PULSE_INTERVALS[toolSound] ?? TOOL_PULSE_INTERVALS["900"];
  // The live pulse jitters each gap up to 2.4×; a fixed pace needs only the base.
  const factor = random ? 2.4 : 1;
  return Math.max(PHASE_PREVIEW_LOCK_MS, Math.round((toolPreviewNotes(interval) - 1) * interval * factor) + 1200);
}

/** React's external-store hook, with a legacy fallback for older React builds. */
function useLegacyStoreSnapshot(store) {
  const [snapshot, setSnapshot] = useState(() => store.getSnapshot());
  useEffect(() => {
    setSnapshot(store.getSnapshot());
    return store.subscribe((next) => setSnapshot(next));
  }, [store]);
  return snapshot;
}

const useStoreSnapshot = typeof React.useSyncExternalStore === "function"
  ? function useStoreSnapshot(store) {
      return React.useSyncExternalStore(
        useCallback((listener) => store.subscribe(listener), [store]),
        useCallback(() => store.getSnapshot(), [store]),
      );
    }
  : useLegacyStoreSnapshot;

/** One select plus its 试听 button; the button disappears for `off`. */
function SelectControl(options) {
  const { label, value, choices, preview, previewLabel, onChange, previewLocked } = options;
  return h(
    "span",
    { className: "dcs-control" },
    h(
      "select",
      {
        className: "dcs-select",
        value,
        "aria-label": label,
        onChange: (event) => onChange(event.target.value),
      },
      choices.map((choice) => h("option", { key: choice.value, value: choice.value }, choice.label)),
    ),
    value === "off"
      ? null
      : h(
          "button",
          {
            type: "button",
            className: "dcs-preview",
            title: previewLabel,
            "aria-label": `${label} ${previewLabel}`,
            disabled: previewLocked === true,
            onClick: preview,
          },
          playIcon(),
        ),
  );
}

/** One range plus its `{value}%` readout and an optional audition. */
function VolumeControl(options) {
  const { label, value, onChange, preview, previewLabel, previewLocked } = options;
  return h(
    "span",
    { className: "dcs-control" },
    h("input", {
      className: "dcs-slider",
      type: "range",
      min: VOLUME_MIN,
      max: VOLUME_MAX,
      step: VOLUME_STEP,
      value,
      "aria-label": label,
      onChange: (event) => onChange(Number(event.target.value)),
    }),
    h("output", { className: "dcs-value" }, `${value}%`),
    typeof preview === "function"
      ? h(
          "button",
          {
            type: "button",
            className: "dcs-preview",
            title: previewLabel,
            "aria-label": `${label} ${previewLabel}`,
            disabled: previewLocked === true,
            onClick: preview,
          },
          playIcon(),
        )
      : null,
  );
}

/** One labelled row: label on the left, control on the right. */
function row(label, control, hint) {
  return h(
    "div",
    { className: "dcs-row" },
    h("span", { className: "dcs-label", title: hint }, label),
    control,
  );
}

/** A bare select without the audition button (phase settings). */
function SelectBox(options) {
  const { label, value, choices, onChange, disabled } = options;
  return h(
    "select",
    {
      className: "dcs-select dcs-select--compact",
      value,
      "aria-label": label,
      disabled: disabled === true,
      onChange: (event) => onChange(event.target.value),
    },
    choices.map((choice) => h("option", { key: choice.value, value: choice.value }, choice.label)),
  );
}

/** The host-style on/off switch used by the phase rows. */
function SwitchControl(options) {
  const { label, checked, onChange } = options;
  return h("button", {
    type: "button",
    role: "switch",
    className: "dcs-switch",
    "aria-checked": checked === true,
    "aria-label": label,
    onClick: () => onChange(checked !== true),
  });
}

/** A compact labeled toggle, used for the tool phase's random pacing. */
function ChipToggle(options) {
  const { label, checked, onChange, disabled, title } = options;
  return h(
    "button",
    {
      type: "button",
      className: "dcs-chip",
      "aria-pressed": checked === true,
      "aria-label": label,
      title: title ?? label,
      disabled: disabled === true,
      onClick: () => onChange(checked !== true),
    },
    label,
  );
}

/** One phase row: label, on/off switch, then the phase's own controls. */
function phaseRow(label, enabled, onToggle, controls) {
  return h(
    "div",
    { className: "dcs-phase-row" },
    h("span", { className: "dcs-label" }, label),
    h("span", { className: "dcs-phase-controls" }, h(SwitchControl, { label, checked: enabled, onChange: onToggle }), ...controls),
  );
}

/**
 * Build the Settings section component.
 *
 * The component is created inside `apply` so it can close over the store, the
 * bound translator and the audio actions; it renders as a normal slot entry and
 * subscribes to the store with `useSyncExternalStore`.
 */
function createSoundSection(deps) {
  const { store, t, subscribeLocale, previewMusic, previewChime, previewNotificationVolume, previewPhase, audioAvailable } = deps;

  return function SoundSection() {
    const snapshot = useStoreSnapshot(store);
    const [, bumpLocale] = useReducer((version) => version + 1, 0);
    useEffect(() => subscribeLocale(() => bumpLocale()), [subscribeLocale]);
    // Rebuilt on every render so a locale switch relabels the dropdowns.
    const musicChoices = PRESET_IDS.map((value) => ({ value, label: t(`music.${value}`) }));
    const soundChoices = SOUND_PREF_IDS.map((value) => ({ value, label: t(`sound.${value}`) }));
    const [busy, setBusy] = useState({});
    const timers = useRef(new Set());
    useEffect(
      () => () => {
        for (const timer of timers.current) clearTimeout(timer);
        timers.current.clear();
      },
      [],
    );

    const lock = (key, action, duration = PREVIEW_LOCK_MS) => {
      if (busy[key] === true) return;
      setBusy((previous) => ({ ...previous, [key]: true }));
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setBusy((previous) => ({ ...previous, [key]: false }));
      }, duration);
      timers.current.add(timer);
      action();
    };

    const current = snapshot.settings;
    const expanded = snapshot.expanded;
    const phasesAudible = current.thinkingSound || current.answerSound || current.toolSound !== "off";
    const status = summarizeSoundStatus(
      current.musicPreset,
      current.successSound,
      current.attentionSound,
      current.notifyVolume,
      phasesAudible,
    );
    const densityChoices = DENSITY_VALUES.map((value) => ({ value: String(value), label: `${value} ${t("charsPerBeat")}` }));
    const pitchChoices = [
      { value: "low", label: t("pitchLow") },
      { value: "normal", label: t("pitchNormal") },
      { value: "high", label: t("pitchHigh") },
    ];
    const toolSpeedChoices = Object.entries(TOOL_PULSE_INTERVALS).map(([value, milliseconds]) => ({
      value,
      label: `${milliseconds / 1000} ${t("secondsUnit")}`,
    }));
    const phasePreview = (phase, enabled, label, lockMs = PHASE_PREVIEW_LOCK_MS) =>
      h(
        "button",
        {
          type: "button",
          className: "dcs-preview",
          title: t("preview"),
          "aria-label": `${label} ${t("preview")}`,
          disabled: !enabled || busy[`phase:${phase}`] === true,
          onClick: () => lock(`phase:${phase}`, () => previewPhase(phase), lockMs),
        },
        playIcon(),
      );

    // The tool row folds its on/off switch into the rate value (`off`), unlike
    // the two text rows, which have a separate switch key. Remember the last
    // live rate so toggling the switch back on does not silently reset the pace
    // the user chose.
    const lastToolRate = useRef(current.toolSound === "off" ? "900" : current.toolSound);
    const toolRate = current.toolSound === "off" ? lastToolRate.current : current.toolSound;
    // The per-phase card: thinking and answer are token-driven and each has its
    // own density/pitch; tool execution has no text, so its rate is the pulse
    // interval (ten steps plus off) and it has the same pitch choice.
    const phaseCard = h(
      "div",
      { className: "dcs-card" },
      h(
        "div",
        { className: "dcs-head" },
        h("span", { className: "dcs-icon", "aria-hidden": true }, speakerIcon()),
        h("span", { className: "dcs-titles" }, h("span", { className: "dcs-title" }, t("phaseTitle")), h("span", { className: "dcs-hint" }, t("phaseHint"))),
      ),
      h(
        "div",
        { className: "dcs-list" },
        phaseRow(t("phaseThinking"), current.thinkingSound, (on) => store.set({ thinkingSound: on }), [
          h(SelectBox, {
            label: `${t("phaseThinking")} ${t("density")}`,
            value: String(current.thinkingDensity),
            choices: densityChoices,
            disabled: !current.thinkingSound,
            onChange: (value) => store.set({ thinkingDensity: Number(value) }),
          }),
          h(SelectBox, {
            label: `${t("phaseThinking")} ${t("pitch")}`,
            value: current.thinkingPitch,
            choices: pitchChoices,
            disabled: !current.thinkingSound,
            onChange: (value) => store.set({ thinkingPitch: value }),
          }),
          phasePreview("thinking", current.thinkingSound, t("phaseThinking")),
        ]),
        phaseRow(t("phaseAnswer"), current.answerSound, (on) => store.set({ answerSound: on }), [
          h(SelectBox, {
            label: `${t("phaseAnswer")} ${t("density")}`,
            value: String(current.answerDensity),
            choices: densityChoices,
            disabled: !current.answerSound,
            onChange: (value) => store.set({ answerDensity: Number(value) }),
          }),
          h(SelectBox, {
            label: `${t("phaseAnswer")} ${t("pitch")}`,
            value: current.answerPitch,
            choices: pitchChoices,
            disabled: !current.answerSound,
            onChange: (value) => store.set({ answerPitch: value }),
          }),
          phasePreview("answer", current.answerSound, t("phaseAnswer")),
        ]),
        phaseRow(t("phaseTool"), current.toolSound !== "off", (on) => store.set({ toolSound: on ? lastToolRate.current : "off" }), [
          h(ChipToggle, {
            label: t("toolRandom"),
            title: t("toolRandomHint"),
            checked: current.toolRandom,
            disabled: current.toolSound === "off",
            onChange: (on) => store.set({ toolRandom: on }),
          }),
          h(SelectBox, {
            label: `${t("phaseTool")} ${t("toolPulse")}`,
            value: toolRate,
            choices: toolSpeedChoices,
            disabled: current.toolSound === "off",
            onChange: (value) => {
              lastToolRate.current = value;
              store.set({ toolSound: value });
            },
          }),
          h(SelectBox, {
            label: `${t("phaseTool")} ${t("pitch")}`,
            value: current.toolPitch,
            choices: pitchChoices,
            disabled: current.toolSound === "off",
            onChange: (value) => store.set({ toolPitch: value }),
          }),
          phasePreview("tool", current.toolSound !== "off", t("phaseTool"), toolAuditionLockMs(current.toolSound, current.toolRandom)),
        ]),
        // Phase sounds are the music layer's three modes, not the notification
        // chimes. With no preset there is no voice to play them through, so say
        // that instead of leaving the user wondering why a preview sounds but a
        // live turn does not.
        current.musicPreset === "off" ? h("div", { className: "dcs-note" }, t("phaseNeedsMusic")) : null,
      ),
    );

    const head = h(
      "div",
      { className: "dcs-head" },
      h("span", { className: "dcs-icon", "aria-hidden": true }, speakerIcon()),
      h("span", { className: "dcs-titles" }, h("span", { className: "dcs-title" }, t("title")), h("span", { className: "dcs-hint" }, t("hint"))),
      h("span", { className: `dcs-badge dcs-badge--${status}` }, t(`status.${status}`)),
      h(
        "button",
        {
          type: "button",
          className: "dcs-toggle",
          "aria-expanded": expanded,
          "aria-controls": PANEL_ID,
          title: t(expanded ? "collapse" : "expand"),
          "aria-label": t(expanded ? "collapse" : "expand"),
          onClick: () => store.setExpanded(!expanded),
        },
        chevronIcon(expanded),
      ),
    );

    // Two explicit categories, in the order they are used: the music layer with
    // its own two session volumes, then the notification layer with its volume
    // and its two chimes. The phase card below is the third category. Keeping
    // the volume next to the layer it controls is what stops "current session
    // volume" from looking like a property of the notification chimes.
    const group = (titleKey, children) =>
      h(
        "div",
        { className: "dcs-group" },
        h("div", { className: "dcs-group-title" }, t(titleKey)),
        ...children,
      );

    const list = h(
      "div",
      { className: "dcs-list", id: PANEL_ID },
        group("groupMusic", [
          row(
            t("music"),
            h(SelectControl, {
              label: t("music"),
              value: current.musicPreset,
              choices: musicChoices,
              previewLabel: t("preview"),
              previewLocked: busy.music === true,
              preview: () => lock("music", () => previewMusic(current.musicPreset)),
              onChange: (next) => {
                store.set({ musicPreset: next });
                if (next !== "off") lock("music", () => previewMusic(next));
              },
            }),
          ),
          row(
            t("currentVolume"),
            h(VolumeControl, {
              label: t("currentVolume"),
              value: current.musicVolumeCurrent,
              onChange: (value) => store.set({ musicVolumeCurrent: value }),
            }),
          ),
          row(
            t("otherVolume"),
            h(VolumeControl, {
              label: t("otherVolume"),
              value: current.musicVolumeOther,
              onChange: (value) => store.set({ musicVolumeOther: value }),
            }),
            t("otherVolumeHint"),
          ),
        ]),
        group("groupNotifications", [
          row(
            t("notifyVolume"),
            h(VolumeControl, {
              label: t("notifyVolume"),
              value: current.notifyVolume,
              // The notification volume is the one slider whose effect cannot be
              // heard live: it only shows up at the next chime. Give it its own
              // audition so a drag is confirmed immediately.
              previewLabel: t("preview"),
              previewLocked: busy.notifyVolume === true,
              preview: () => lock("notifyVolume", () => previewNotificationVolume()),
              onChange: (value) => store.set({ notifyVolume: value }),
            }),
          ),
          row(
            t("success"),
            h(SelectControl, {
              label: t("success"),
              value: current.successSound,
              choices: soundChoices,
              previewLabel: t("preview"),
              previewLocked: busy.success === true,
              preview: () => lock("success", () => previewChime("success")),
              onChange: (next) => {
                store.set({ successSound: next });
                if (next !== "off") lock("success", () => previewChime("success"));
              },
            }),
          ),
          row(
            t("attention"),
            h(SelectControl, {
              label: t("attention"),
              value: current.attentionSound,
              choices: soundChoices,
              previewLabel: t("preview"),
              previewLocked: busy.attention === true,
              preview: () => lock("attention", () => previewChime("attention")),
              onChange: (next) => {
                store.set({ attentionSound: next });
                if (next !== "off") lock("attention", () => previewChime("attention"));
              },
            }),
          ),
        ]),
        audioAvailable ? null : h("div", { className: "dcs-note", role: "note" }, t("noAudio")),
    );
    const mainCard = h("div", { className: "dcs-card" }, head, expanded ? list : null);
    // The chevron says it collapses the sound settings; both cards belong to
    // that section, so one state controls both instead of leaving the phase card
    // expanded below a collapsed control.
    return h("div", { className: "dcs-stack" }, mainCard, expanded ? phaseCard : null);
  };
}
