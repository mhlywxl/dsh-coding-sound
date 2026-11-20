/**
 * Package identity, the Settings section coordinates, and the audition timing
 * windows shared by the section and the plugin body.
 */

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
