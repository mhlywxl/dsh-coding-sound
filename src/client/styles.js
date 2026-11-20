/** The plugin's stylesheet, scoped to the `dcs-` prefix. */

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
.dcs-group{display:flex;flex-direction:column;gap:10px}
.dcs-group+.dcs-group{margin-top:6px;padding-top:10px;border-top:0.5px dashed var(--dsw-alias-border-l1,rgba(127,127,127,.14))}
.dcs-group-title{font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,inherit);opacity:.9}
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
.dcs-chip{flex:none;height:24px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:11px;line-height:1;cursor:pointer;transition:background .15s ease,color .15s ease}
.dcs-chip[aria-pressed="true"]{background:var(--dsw-alias-brand-primary,#2f6feb);border-color:transparent;color:#fff}
.dcs-chip:disabled{opacity:.45;cursor:default}
.dcs-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:2px}
.dcs-nav{display:inline-flex;align-items:center;gap:6px;min-width:0;color:inherit}
.dcs-nav-icon{display:inline-flex;flex:none;align-items:center}
.dcs-nav-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The shell's nav falls back to a gear for section ids it does not know; hide
   that fallback only on the row carrying our own speaker label. */
button:has(> span [data-coding-sound-nav])>svg{display:none}
@media (prefers-reduced-motion: no-preference){.dcs-toggle svg{transition:transform .12s ease}}
`;

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
