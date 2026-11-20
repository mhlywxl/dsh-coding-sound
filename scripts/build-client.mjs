#!/usr/bin/env node
/**
 * Assemble `client.js` from the ordered source modules in `src/client/`.
 *
 * The DSH client loads exactly ONE module artifact per package
 * (`window.__ModuleLoader__.load`, id = package name), so the sources
 * intentionally share one module-loader closure and are concatenated in
 * dependency order. Keeping the artifact generated lets the source stay
 * reviewable without adding a runtime bundler or an npm build dependency.
 *
 * `client.js` lives at the package root because that is the file the DSH loader
 * loads for the `./client` export; `src/client/*` is authoring source and is
 * not shipped to npm.
 *
 * Usage:
 *   node scripts/build-client.mjs          write client.js
 *   node scripts/build-client.mjs --check  exit 1 when client.js is stale
 *   node scripts/build-client.mjs --watch  rebuild whenever src/client changes
 */
import { existsSync, readdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "src", "client");
const OUTPUT = join(ROOT, "client.js");
const PACKAGE = "dsh-coding-sound";

/**
 * Load order. Every entry is one authoring module; later modules may use every
 * binding declared by earlier ones (single module-loader closure).
 * `entry.js` must be first and `apply.js` must be last.
 */
const MODULES = [
  "entry.js",
  "constants.js",
  "styles.js",
  "locale.js",
  "icons.js",
  "presets.js",
  "settings.js",
  "chimes.js",
  "engine.js",
  "observer.js",
  "sessions.js",
  "section.js",
  "apply.js",
];

const BANNER = `/**
 * GENERATED FILE — edit src/client/*.js and run \`node scripts/build-client.mjs\`.
 * The modules share one module-loader closure; their order matters.
 */
`;

const PREAMBLE = `window.__ModuleLoader__.load({
  id: "${PACKAGE}",
  factory(require) {
    try {
`;

const EPILOGUE = `    } catch (error) {
      /* Every module sits in an initial boot batch, so letting this escape
         would blank the whole page over a cosmetic audio plugin. Stay a plugin
         failure: no Settings section, and the reason on the console. */
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("[coding-sound] client module failed to load; Settings stays unchanged", error);
      }
      return { name: "coding-sound", apply() {} };
    }
  },
});
`;

/** Indent an authoring module so the concatenated factory stays readable. */
function indent(source) {
  return source
    .split("\n")
    .map((line) => (line.length === 0 ? "" : `      ${line}`))
    .join("\n");
}

function assemble() {
  const parts = [BANNER, PREAMBLE];
  for (const name of MODULES) {
    const source = readFileSync(join(SOURCE_DIR, name), "utf8").replace(/\r\n/g, "\n").trimEnd();
    parts.push(`      //#region src/client/${name}\n${indent(source)}\n      //#endregion src/client/${name}\n\n`);
  }
  parts.push(EPILOGUE);
  return parts.join("");
}

/**
 * Fail loudly when the manifest and `src/client/` disagree, or when the fixed
 * ends move: `entry.js` opens the shared closure and `apply.js` returns the
 * plugin object, so the order is part of the contract.
 */
function checkManifest() {
  const present = readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort();
  const listed = [...MODULES].sort();
  const missing = listed.filter((name) => present.indexOf(name) === -1);
  const unlisted = present.filter((name) => listed.indexOf(name) === -1);
  if (missing.length > 0) throw new Error(`build manifest names missing modules: ${missing.join(", ")}`);
  if (unlisted.length > 0) throw new Error(`src/client has modules missing from the build manifest: ${unlisted.join(", ")}`);
  if (new Set(MODULES).size !== MODULES.length) throw new Error("build manifest lists a module twice");
  if (MODULES[0] !== "entry.js") throw new Error("build manifest must start with entry.js");
  if (MODULES[MODULES.length - 1] !== "apply.js") throw new Error("build manifest must end with apply.js");
  checkTopLevelNames();
}

/**
 * A duplicate top-level `const`/`let`/`class` is a syntax error (`node --check`
 * catches it), but a duplicate top-level `function` declaration would silently
 * shadow the earlier one because the deployed `client.js` uses no `"use strict"`
 * directive. Reject that case here so a split-across-modules helper stays safe.
 */
function checkTopLevelNames() {
  const seen = new Map();
  const duplicates = [];
  for (const name of MODULES) {
    const source = readFileSync(join(SOURCE_DIR, name), "utf8").replace(/\r\n/g, "\n");
    for (const match of source.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const declared = match[1];
      if (seen.has(declared)) duplicates.push(`${declared} (${seen.get(declared)} and ${name})`);
      else seen.set(declared, name);
    }
  }
  if (duplicates.length > 0) throw new Error(`duplicate top-level function names across modules: ${duplicates.join(", ")}`);
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  checkManifest();
  const write = () => {
    const next = assemble();
    writeFileSync(OUTPUT, next, "utf8");
    console.log(`built client.js from ${MODULES.length} modules (${next.length} bytes)`);
  };
  if (process.argv.includes("--check")) {
    const expected = assemble();
    const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== expected) {
      console.error("client.js is stale — run `npm run build`.");
      process.exitCode = 1;
    } else {
      console.log(`client.js is current (${MODULES.length} modules, ${expected.length} bytes)`);
    }
  } else if (process.argv.includes("--watch")) {
    write();
    let timer = null;
    watch(SOURCE_DIR, { persistent: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          checkManifest();
          write();
          console.log("refresh the DSH page to pick up the rebuilt bundle");
        } catch (error) {
          console.error(`build: ${error instanceof Error ? error.message : error}`);
        }
      }, 100);
    });
    console.log("watching src/client/ — Ctrl+C stops");
  } else {
    write();
  }
}

export { MODULES, assemble, OUTPUT as target };