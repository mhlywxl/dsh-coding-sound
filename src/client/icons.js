/** Inline glyphs shared by the Settings section and the plugin body. */

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
