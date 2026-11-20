/**
 * Browser half of the coding-sound plugin — module-loader entry.
 *
 * The DSH client loads exactly one `client.js` artifact per package, so the
 * sources under `src/client/` are concatenated into one factory closure in the
 * order declared by the `MODULES` manifest in `scripts/build-client.mjs`. This
 * first module opens the shared scope: it resolves React through the loader's
 * own module table and declares the hooks the Settings section uses. The last
 * module (`apply.js`) returns the plugin object.
 *
 * Architecture map (entry → apply):
 *   entry / constants / styles / locale / icons
 *   presets → settings → chimes → engine → observer → sessions
 *   section (Settings → 声音与提醒) → apply (plugin body)
 *
 * Lifecycle: every timer, listener and audio node is created inside
 * `ctx.effect`, so an unload or HMR tears the sound down instead of leaving a
 * context playing after the plugin is gone.
 */

const React = require("react");
const h = React.createElement;
const { useState, useEffect, useReducer, useCallback, useRef } = React;

/**
 * Offline-test seam: every pure module publishes its public surface here and
 * `apply.js` exposes the object as `__test` on the plugin export. Nothing in
 * the plugin reads it at runtime; `test.mjs` evaluates the built bundle and
 * exercises these helpers/classes without a browser.
 */
const __test = {};
