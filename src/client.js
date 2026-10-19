/**
 * Browser half of the coding-sound plugin.
 *
 * Owns the page's sound runtime — one `AudioContext`, one generative-music
 * engine with a voice per running session, the two notification voices — and
 * the "声音" section in Settings.
 *
 * The code is authored as one module because the browser module graph loads a
 * single `./client` artifact per package; `build.mjs` wraps the files under
 * `src/` into the `window.__ModuleLoader__` factory this file is written for.
 *
 * Lifecycle: every timer, listener and audio node is created inside
 * `ctx.effect`, so an unload or HMR tears the sound down instead of leaving a
 * context playing after the plugin is gone.
 */

const React = require("react");
const h = React.createElement;
const { useState, useEffect, useReducer, useCallback, useRef } = React;

const {
  SettingsStore,
  SOUND_PREF_IDS,
  DENSITY_VALUES,
  TOOL_PULSE_INTERVALS,
  VOLUME_MIN,
  VOLUME_MAX,
  VOLUME_STEP,
  summarizeSoundStatus,
} = settings;
const { PRESET_IDS } = presets;
const { AudioBus, MusicEngine } = engine;
const { ChimePlayer } = chimes;
const { SessionVoices } = sessions;
const { ChatTextObserver } = observer;

/** Package identity; also the Loader row id. */
const PACKAGE_ID = "dsh-coding-sound";
/** Loader row id, which is also the `configForms` namespace for this row. */
const SETTINGS_SCOPE = "coding-sound";
/** Locale namespace owned by the settings section. */
const SETTINGS_NS = "settings.coding-sound";
/** Stylesheet marker, unique to this plugin. */
const STYLE_ID = "dsh-coding-sound/style.css";
/** Settings nav entry id and position. */
const SECTION_ID = "coding-sound";
const SECTION_ORDER = 35;
/** How long a 试听 button stays disabled after a click (no stacked previews). */
const PREVIEW_LOCK_MS = 700;
/** A phase audition is a phrase, not a single chime: keep it from stacking. */
const PHASE_PREVIEW_LOCK_MS = 1800;
/** The card's panel id, referenced by `aria-controls`. */
const PANEL_ID = "coding-sound-panel";

const CSS = `
.dcs-card{display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-width:720px;padding:12px 14px;border:0.5px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:12px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit)}
.dcs-head{display:flex;align-items:center;gap:10px;min-height:28px}
.dcs-icon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:var(--dsw-alias-label-secondary,inherit)}
.dcs-titles{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
.dcs-title{font-size:13px;font-weight:600;line-height:1.35}
.dcs-hint{font-size:11px;line-height:1.35;color:var(--dsw-alias-label-secondary,inherit);opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcs-badge{flex:none;padding:2px 8px;border-radius:999px;border:0.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));font-size:10px;line-height:1.6;white-space:nowrap}
.dcs-badge--allOff{color:var(--dsw-alias-state-idle-primary,var(--dsw-alias-label-secondary,inherit))}
.dcs-badge--enabled{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-primary,inherit));border-color:var(--dsw-alias-state-success-primary,var(--dsw-alias-border-l2,rgba(127,127,127,.3)))}
.dcs-badge--custom{color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary,inherit));border-color:var(--dsw-alias-brand-primary,var(--dsw-alias-border-l2,rgba(127,127,127,.3)))}
.dcs-toggle{display:inline-flex;flex:none;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer}
.dcs-toggle:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}
.dcs-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:1px}
.dcs-list{display:flex;flex-direction:column;gap:10px;margin-top:12px;padding-top:12px;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dcs-row{display:flex;align-items:center;gap:12px;min-height:26px}
.dcs-label{flex:1;min-width:0;font-size:12px;line-height:1.4;color:var(--dsw-alias-label-secondary,inherit)}
.dcs-control{display:inline-flex;flex:none;align-items:center;gap:6px}
.dcs-select{min-width:112px;height:26px;box-sizing:border-box;padding:0 6px;border:0.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:7px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12px;line-height:1;cursor:pointer}
.dcs-select:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}
.dcs-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:1px}
.dcs-preview{display:inline-flex;flex:none;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer}
.dcs-preview:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}
.dcs-preview:disabled{opacity:.45;cursor:default}
.dcs-preview:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:1px}
.dcs-slider{-webkit-appearance:none;appearance:none;width:148px;height:3px;margin:0;border-radius:999px;background:var(--dsw-alias-border-l2,rgba(127,127,127,.35));outline:none;cursor:pointer}
.dcs-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border:0;border-radius:50%;background:var(--dsw-alias-brand-primary,#2f6feb);cursor:pointer}
.dcs-slider::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:var(--dsw-alias-brand-primary,#2f6feb);cursor:pointer}
.dcs-slider:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:3px}
.dcs-value{min-width:40px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,inherit)}
.dcs-note{margin-top:2px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary,inherit);opacity:.75}
.dcs-stack{display:flex;flex-direction:column;gap:12px;width:100%;max-width:720px}
.dcs-stack .dcs-card{max-width:none}
.dcs-phase-row{display:flex;align-items:center;gap:10px;min-height:30px;flex-wrap:wrap}
.dcs-phase-row .dcs-label{flex:1;min-width:64px}
.dcs-phase-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dcs-select--compact{min-width:88px}
.dcs-select:disabled{opacity:.45;cursor:default}
.dcs-switch{position:relative;flex:none;width:34px;height:20px;padding:0;border:0.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.2));cursor:pointer;transition:background .15s ease}
.dcs-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-base,#fff);transition:transform .15s ease}
.dcs-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary,#2f6feb);border-color:transparent}
.dcs-switch[aria-checked="true"]::after{transform:translateX(14px)}
.dcs-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:2px}
.dcs-nav{display:inline-flex;align-items:center;gap:6px;min-width:0;color:inherit}
.dcs-nav-icon{display:inline-flex;flex:none;align-items:center}
.dcs-nav-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The shell's nav falls back to a gear for section ids it does not know; hide
   that fallback only on the row carrying our own speaker label. */
button:has(> span [data-coding-sound-nav])>svg{display:none}
@media (prefers-reduced-motion: no-preference){.dcs-toggle svg{transition:transform .12s ease}}
`;

/** Dictionary keys are shared by both locales; `zh` is the reference text. */
const zh = Object.freeze({
  nav: "声音",
  title: "声音",
  hint: "背景音乐与通知音效",
  "status.allOff": "全部关闭",
  "status.enabled": "已启用",
  "status.custom": "已自定义",
  expand: "展开声音设置",
  collapse: "折叠声音设置",
  music: "生成式背景音乐",
  "music.off": "关闭",
  "music.ethereal": "空灵",
  "music.classic": "经典",
  "music.digital": "数字",
  "music.retro": "复古",
  notifyVolume: "通知音量",
  success: "生成完成",
  attention: "等待操作",
  "sound.off": "关闭",
  "sound.synth": "合成音效",
  "sound.positive": "正面通知",
  "sound.correct": "正确提示",
  "sound.start": "界面启动",
  "sound.back": "界面返回",
  preview: "试听",
  currentVolume: "当前会话音量",
  otherVolume: "其他会话音量",
  otherVolumeHint: "其他会话仍在后台工作时使用的音量",
  noAudio: "这个浏览器不支持 Web Audio，声音无法播放。",
  phaseTitle: "阶段声音",
  phaseHint: "思考 / 回答 / 工具执行，可分别关闭与调整",
  phaseThinking: "思考",
  phaseAnswer: "回答正文",
  phaseTool: "工具执行",
  charsPerBeat: "字/拍",
  density: "密度",
  pitch: "音高",
  pitchLow: "低",
  pitchNormal: "标准",
  pitchHigh: "高",
  toolPulse: "脉冲",
  speedSlow: "慢",
  speedNormal: "标准",
  speedFast: "快",
});

const en = Object.freeze({
  nav: "Sound",
  title: "Sound",
  hint: "Background music and notification sounds",
  "status.allOff": "All off",
  "status.enabled": "Enabled",
  "status.custom": "Customized",
  expand: "Expand sound settings",
  collapse: "Collapse sound settings",
  music: "Generative background music",
  "music.off": "Off",
  "music.ethereal": "Ethereal",
  "music.classic": "Classic",
  "music.digital": "Digital",
  "music.retro": "Retro",
  notifyVolume: "Notification volume",
  success: "Generation complete",
  attention: "Waiting for input",
  "sound.off": "Off",
  "sound.synth": "Synth",
  "sound.positive": "Positive",
  "sound.correct": "Correct",
  "sound.start": "UI start",
  "sound.back": "UI back",
  preview: "Preview",
  currentVolume: "Current session volume",
  otherVolume: "Other sessions volume",
  otherVolumeHint: "Volume used by sessions still working in the background",
  noAudio: "This browser has no Web Audio; sound cannot play.",
  phaseTitle: "Phase sounds",
  phaseHint: "Thinking / answer / tool execution — each can be tuned or muted",
  phaseThinking: "Thinking",
  phaseAnswer: "Answer",
  phaseTool: "Tool execution",
  charsPerBeat: "chars/beat",
  density: "density",
  pitch: "pitch",
  pitchLow: "Low",
  pitchNormal: "Normal",
  pitchHigh: "High",
  toolPulse: "pulse",
  speedSlow: "Slow",
  speedNormal: "Normal",
  speedFast: "Fast",
});

/** Insert the plugin stylesheet once; removed by the plugin's disposer. */
function ensureStyles(document) {
  if (document === undefined || document === null) return null;
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`);
  if (existing !== null) return existing;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_ID;
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
  return tag;
}

/** A speaker glyph in the host's label color. */
function speakerIcon() {
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", "aria-hidden": true },
    h("path", {
      d: "M4 9.5h3.2L11 6.2a.9.9 0 0 1 1.4.7v10.2a.9.9 0 0 1-1.4.7L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z",
      fill: "currentColor",
    }),
    h("path", {
      d: "M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
    }),
  );
}

function playIcon() {
  return h("svg", { viewBox: "0 0 16 16", width: 13, height: 13, "aria-hidden": true }, h("path", { d: "M5 3.5v9l7-4.5z", fill: "currentColor" }));
}

function chevronIcon(expanded) {
  return h(
    "svg",
    { viewBox: "0 0 16 16", width: 15, height: 15, fill: "none", "aria-hidden": true, style: { transform: expanded ? "rotate(180deg)" : "none" } },
    h("path", { d: "M4 6.5 8 10.5l4-4", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }),
  );
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
            "aria-label": previewLabel,
            disabled: previewLocked === true,
            onClick: preview,
          },
          playIcon(),
        ),
  );
}

/** One range plus its `{value}%` readout. */
function VolumeControl(options) {
  const { label, value, onChange } = options;
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
  const { store, t, subscribeLocale, previewMusic, previewChime, previewPhase, audioAvailable } = deps;

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
    const status = summarizeSoundStatus(current.musicPreset, current.successSound, current.attentionSound, current.notifyVolume);
    const densityChoices = DENSITY_VALUES.map((value) => ({ value: String(value), label: `${value} ${t("charsPerBeat")}` }));
    const pitchChoices = [
      { value: "low", label: t("pitchLow") },
      { value: "normal", label: t("pitchNormal") },
      { value: "high", label: t("pitchHigh") },
    ];
    const toolSpeedChoices = [
      { value: "slow", label: t("speedSlow") },
      { value: "normal", label: t("speedNormal") },
      { value: "fast", label: t("speedFast") },
    ];
    const phasePreview = (phase, enabled, label) =>
      h(
        "button",
        {
          type: "button",
          className: "dcs-preview",
          title: t("preview"),
          "aria-label": `${label} ${t("preview")}`,
          disabled: !enabled || busy[`phase:${phase}`] === true,
          onClick: () => lock(`phase:${phase}`, () => previewPhase(phase), PHASE_PREVIEW_LOCK_MS),
        },
        playIcon(),
      );

    // The per-phase card: thinking and answer are token-driven and each has its
    // own density/pitch; tool execution has no text, so it only has a pulse speed.
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
        phaseRow(t("phaseTool"), current.toolSound !== "off", (on) => store.set({ toolSound: on ? "normal" : "off" }), [
          h(SelectBox, {
            label: `${t("phaseTool")} ${t("toolPulse")}`,
            value: current.toolSound === "off" ? "normal" : current.toolSound,
            choices: toolSpeedChoices,
            disabled: current.toolSound === "off",
            onChange: (value) => store.set({ toolSound: value }),
          }),
          phasePreview("tool", current.toolSound !== "off", t("phaseTool")),
        ]),
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

    const list = h(
      "div",
      { className: "dcs-list", id: PANEL_ID },
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
          t("notifyVolume"),
          h(VolumeControl, {
            label: t("notifyVolume"),
            value: current.notifyVolume,
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
        audioAvailable ? null : h("div", { className: "dcs-note", role: "note" }, t("noAudio")),
    );
    const mainCard = h("div", { className: "dcs-card" }, head, expanded ? list : null);
    return h("div", { className: "dcs-stack" }, mainCard, phaseCard);
  };
}

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
  // a volume change only re-points the per-session gains.
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
        voices.setCurrent();
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
      music.preview(preset);
    },
    previewChime: (kind) => {
      void bus.resume();
      void player.play(kind, store.get());
    },
    previewPhase: (phase) => {
      const settingsValue = store.get();
      void bus.resume();
      if (phase === "thinking") {
        if (!settingsValue.thinkingSound) return;
        music.previewPhrase({ pitch: settingsValue.thinkingPitch, intervalMs: 60 + settingsValue.thinkingDensity * 30, count: 4 });
        return;
      }
      if (phase === "answer") {
        if (!settingsValue.answerSound) return;
        music.previewPhrase({ pitch: settingsValue.answerPitch, intervalMs: 60 + settingsValue.answerDensity * 30, count: 4 });
        return;
      }
      const interval = TOOL_PULSE_INTERVALS[settingsValue.toolSound];
      if (interval === undefined) return;
      music.previewPhrase({ count: 3, intervalMs: interval, velocity: 0.55, pitch: "normal" });
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

module.exports = {
  inject: ["slots", "uiSession", "locale"],
  apply,
};
