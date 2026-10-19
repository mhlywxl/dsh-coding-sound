/**
 * The chat-transcript observer: turns the rendered answer into character
 * deltas, which the engine turns into beats.
 *
 * Why the rendered transcript: a streaming chat node exposes no per-character
 * signal on its slot props, and "the music follows what is being typed" means
 * reading what the host actually painted. The watcher is limited to the
 * `data-chat-flow-kind` wrappers the Conversation layer already publishes.
 *
 * The hard part is telling a stream from a repaint. The host reuses rows,
 * mounts finished answers whole, re-renders markdown as it becomes valid, and
 * attaches footers when a turn ends; each of those looks like "text appeared" to
 * a naive counter. Three cheap invariants separate them:
 *
 *  - a row's text only ever grows by appending (prefix test) — a swapped row is
 *    a different conversation's content on a recycled element;
 *  - a row's first read is always a baseline, never a beat;
 *  - a single flush that reveals a whole block at once is a mount, not typing.
 */

/** A root's FIRST growth this large is content arriving whole, not typing. */
const FIRST_GROWTH_MAX = 24;
/** A frame longer than this would schedule a burst; keep one beat and move on. */
const MAX_DELTA = 24;
/** Any later single flush revealing more than this is a re-render, never typing. */
const MOUNT_JUMP = 160;
/** Flow wrappers tracked at once, so a long session stays bounded. */
const MAX_TRACKED = 400;
/** Rendered characters kept per wrapper: enough to recognise an append. */
const TEXT_HEAD = 2048;

/** Subtrees that are chrome or payload, never prose. */
const EXCLUDED_TAGS = new Set([
  "PRE",
  "CODE",
  "KBD",
  "SAMP",
  "BUTTON",
  "SVG",
  "TIME",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "SCRIPT",
  "STYLE",
]);

/** Hashed class names keep their semantic suffix, which is what these match. */
const EXCLUDED_HINTS = ["CodeBlock", "JsonBlock", "actions", "toolbar"];

function isElement(value) {
  const ElementClass = globalThis.Element;
  return typeof ElementClass === "function" && value instanceof ElementClass;
}

function attributeOf(element, name) {
  return typeof element.getAttribute === "function" ? element.getAttribute(name) : null;
}

function isExcluded(element) {
  const tagName = element.tagName;
  if (typeof tagName === "string" && EXCLUDED_TAGS.has(tagName)) return true;
  const className = typeof element.className === "string" ? element.className : "";
  for (const hint of EXCLUDED_HINTS) if (className.includes(hint)) return true;
  if (attributeOf(element, "hidden") !== null) return true;
  // The host marks its own hover toolbar with this; it is not part of the answer.
  if (attributeOf(element, "data-actions-reveal") !== null) return true;
  return false;
}

/** Nearest ancestor wrapper the Conversation layer marked as one chat flow item. */
function flowRootOf(node) {
  let current = isElement(node) ? node : node?.parentElement ?? null;
  while (current !== null && current !== undefined) {
    if (current.hasAttribute?.("data-chat-flow-kind") === true) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Walk one flow wrapper and report the characters it contributes.
 * Excluded subtrees are skipped, and whitespace is dropped: a beat per visible
 * character, not per space.
 */
function walkFlowCharacters(root, visit) {
  for (const child of root.childNodes ?? []) {
    if (child.nodeType === 1) {
      if (!isExcluded(child)) walkFlowCharacters(child, visit);
      continue;
    }
    if (child.nodeType !== 3) continue;
    for (const character of Array.from(child.data ?? "")) {
      if (/\s/.test(character)) continue;
      visit(character);
    }
  }
}

/**
 * Everything one flow wrapper currently shows.
 * @returns {{text: string, count: number, kept: string[]}}
 */
function readFlow(root) {
  const kept = [];
  let text = "";
  walkFlowCharacters(root, (character) => {
    kept.push(character);
    text += character;
  });
  return { text, count: kept.length, kept };
}

/** The default root filter: the assistant's own prose, not its thinking half. */
function isAnswerRoot(root) {
  return attributeOf(root, "data-chat-flow-kind") === "assistant-step" && attributeOf(root, "data-chat-group-part") !== "reasoning";
}

/** Reads the rendered transcript and reports the characters that appeared. */
class ChatTextObserver {
  /**
   * @param {object} options
   * @param {(characters: string[]) => void} options.onCharacters
   * @param {(root: Element) => boolean} [options.shouldTrackRoot]
   * @param {Document} [options.document]
   * @param {typeof MutationObserver} [options.MutationObserver]
   */
  constructor(options) {
    this.onCharacters = options.onCharacters;
    this.shouldTrackRoot = options.shouldTrackRoot ?? isAnswerRoot;
    this.document = options.document ?? globalThis.document;
    this.MutationObserverClass = options.MutationObserver ?? globalThis.MutationObserver;
    this.observer = null;
    /** @type {Map<Element, {head: string, length: number, count: number, grows: number}>} */
    this.seen = new Map();
    this.pending = 0;
    this.targets = new Set();
  }

  start() {
    if (this.observer !== null || this.document === undefined || this.document === null) return;
    const Observer = this.MutationObserverClass;
    if (typeof Observer !== "function") return;
    const body = this.document.body;
    if (body === null || body === undefined) {
      // A bundle may load before <body> exists; wait instead of losing the watcher.
      this.document.addEventListener?.("DOMContentLoaded", () => this.start(), { once: true });
      return;
    }
    // Whatever the transcript already shows is the baseline: a reply that mounts
    // whole (a restored session, a scrolled-in turn) animates in, it does not type.
    this.seed(body);
    this.observer = new Observer((records) => this.#onMutations(records));
    this.observer.observe(body, { subtree: true, childList: true, characterData: true });
  }

  /** Record the current state of every flow wrapper under `body`. */
  seed(body = this.document?.body) {
    if (body === null || body === undefined || typeof body.querySelectorAll !== "function") return;
    for (const root of body.querySelectorAll("[data-chat-flow-kind]")) {
      this.seen.set(root, this.#fingerprint(root));
    }
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    this.seen.clear();
    this.targets.clear();
    this.pending = 0;
  }

  /** Forget what has been counted; the next read counts a whole turn as a baseline. */
  reset() {
    this.seen.clear();
    this.targets.clear();
    this.pending = 0;
  }

  #fingerprint(root) {
    const { text, count } = readFlow(root);
    return { head: text.slice(0, TEXT_HEAD), length: text.length, count, grows: 0 };
  }

  #onMutations(records) {
    for (const record of records) {
      if (record.type === "characterData") {
        this.#countFrom(record.target);
        continue;
      }
      for (const node of record.removedNodes ?? []) {
        if (isElement(node) && this.seen.has(node)) this.seen.delete(node);
      }
      for (const node of record.addedNodes ?? []) this.#countFrom(node);
    }
    this.#flush();
  }

  #countFrom(node) {
    const root = flowRootOf(node ?? null);
    if (root === null) return;
    this.targets.add(root);
    this.pending += 1;
  }

  #flush() {
    if (this.pending === 0) return;
    this.pending = 0;
    if (this.targets.size === 0) return;
    const characters = [];
    for (const root of this.targets) {
      const { text, count, kept } = readFlow(root);
      const head = text.slice(0, TEXT_HEAD);
      const previous = this.seen.get(root);
      // A wrapper seen for the first time already held whatever it holds:
      // mounted content, not typed content.
      if (previous === undefined) {
        this.seen.set(root, { head, length: text.length, count, grows: 0 });
        continue;
      }
      // Its text shrank, or no longer starts with what it showed before: the host
      // reused the element for other content. That is not speech; it is a baseline.
      if (text.length < previous.length || !text.startsWith(previous.head)) {
        this.seen.set(root, { head, length: text.length, count, grows: 0 });
        continue;
      }
      const delta = count - previous.count;
      const grows = delta > 0 ? previous.grows + 1 : previous.grows;
      this.seen.set(root, { head, length: text.length, count, grows });
      if (delta <= 0) continue;
      if (!this.shouldTrackRoot(root)) continue;
      // A block that landed in one flush, on a root that never typed before, was
      // mounted; so was anything this large even on a root that has been typing.
      if (delta > (previous.grows === 0 ? FIRST_GROWTH_MAX : MOUNT_JUMP)) continue;
      characters.push(...kept.slice(Math.max(0, kept.length - Math.min(delta, MAX_DELTA))));
    }
    this.targets.clear();
    if (this.seen.size > MAX_TRACKED) this.#prune();
    if (characters.length > 0) this.onCharacters(characters);
  }

  /** Drop wrappers the transcript no longer holds, so a long session stays bounded. */
  #prune() {
    for (const root of [...this.seen.keys()]) {
      if (this.seen.size <= MAX_TRACKED) break;
      if (root.isConnected === false) this.seen.delete(root);
    }
  }
}

module.exports = {
  FIRST_GROWTH_MAX,
  MAX_DELTA,
  MOUNT_JUMP,
  MAX_TRACKED,
  TEXT_HEAD,
  isAnswerRoot,
  flowRootOf,
  readFlow,
  ChatTextObserver,
};
