// Helper for tests: load every content script into the current jsdom global
// scope, in the same order manifest.json loads them. Tests then interact with
// window.__JAF directly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Mirror manifest.json content_scripts.js, minus main.js (which mounts the
// floating button and reads chrome.storage — irrelevant for filler tests).
const FILES = [
  "content/utils.js",
  "content/adapters.js",
  "content/matcher.js",
  "content/labels.js",
  "content/fillers/native.js",
  "content/fillers/radios.js",
  "content/fillers/checkboxes.js",
  "content/fillers/react-select.js",
  "content/fillers/listbox.js",
  "content/fillers/ashby-buttons.js",
];

// jsdom doesn't implement the CSS interface. Polyfill the only bit we use.
function ensureCssEscape() {
  if (typeof window.CSS === "undefined" || typeof window.CSS.escape !== "function") {
    window.CSS = window.CSS || {};
    // Minimal CSS.escape — sufficient for ids we hand it in tests.
    window.CSS.escape = (s) =>
      String(s).replace(/[^a-zA-Z0-9_\-]/g, (ch) => "\\" + ch);
  }
}

export function loadJAF() {
  // Reset namespace between loads so tests don't leak state.
  delete window.__JAF;
  delete window.__jobAutoFillLoaded;
  ensureCssEscape();
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(root, f), "utf-8");
    // Indirect eval runs in the global scope, so the IIFE's `window` resolves
    // to jsdom's window.
    (0, eval)(code);
  }
  return window.__JAF;
}

export function loadFixture(name) {
  const html = fs.readFileSync(path.join(root, "tests", "fixtures", name), "utf-8");
  // Reset document body for each fixture
  document.documentElement.innerHTML = html;
}
