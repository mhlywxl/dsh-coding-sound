/**
 * Host half of the coding-sound bundle.
 *
 * The feature lives entirely in the page: the Client module owns the audio
 * engine, the session watcher, and the Settings section, and every chime is
 * synthesized with Web Audio. This half exists so the bundle owns a real row in
 * the Loader tree, which is what the Plugin Manager and the Settings plugin
 * inventory display — and what makes the package installable with
 * `dsh plugin add`.
 */

/** @param {import('@deepseek-ai/cordis').Context} _ctx */
export function apply(_ctx) {}
