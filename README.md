# JobAutoFill

A no-frills Chrome extension that autofills Greenhouse and Ashby job applications. Saves you from re-typing your name, email, phone, links, work-authorization answers, and the voluntary self-ID section on every application.

## What it does

- Adds a floating **Autofill** button on:
  - Greenhouse: `job-boards.greenhouse.io/*/jobs/*` and `boards.greenhouse.io/*/jobs/*`
  - Ashby: `jobs.ashbyhq.com/*`
  - Lever: `jobs.lever.co/*`
  - Workable: `apply.workable.com/*` (not the `jobs.workable.com` aggregator — the real apply form lives at apply.workable.com)
- One click fills:
  - Basics: first / last / preferred name, email, phone, location, country, pronouns
  - Links: LinkedIn, GitHub, portfolio, other website
  - Work authorization questions (authorized to work, sponsorship needed, years of experience)
  - Voluntary self-ID: gender, Hispanic/Latino, race, veteran status, disability
  - Common essay-ish questions like "Why do you want to join…" and "Additional information"
- Leaves resume/cover letter uploads alone — Chrome extensions can't attach local files to a form for security reasons, so you'll still drag those in yourself.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select this folder (`JobAutoFill`).
5. Pin the extension to the toolbar if you want quick access to the profile editor.

## Setup your profile

1. Click the JobAutoFill toolbar icon.
2. Fill in the fields you care about. Anything left blank is simply skipped during autofill.
3. Changes save automatically when you blur a field or click **Save**.
4. Profile is stored in `chrome.storage.sync`, so it follows your Chrome profile across machines you're signed into.

## Use

1. Open a Greenhouse application page (e.g. the Figma posting that started this project).
2. Click the blue **Autofill** button in the bottom-right.
3. Review the filled-in form, attach your resume, fix anything that needed manual judgment, then submit.

A toast tells you how many fields were filled. If the count is lower than you expect, the most likely cause is a custom question with wording the matcher didn't recognize — open the page console (`Cmd+Option+J`), look for `[JobAutoFill]` logs, and adjust `PATTERNS` in `content/matcher.js`.

## How it works (briefly)

- `manifest.json` — MV3 manifest, scopes content scripts to Greenhouse, Ashby, Lever, and Workable.
- `popup.html` / `popup.js` / `popup.css` — the editable profile form.
- `content/` — content-script modules loaded in order by the manifest:
  - `utils.js` — `sleep`, `norm`, `wordSet`, `setNativeValue` (React-aware value setter), `fireRealClick` (full mouse-event chain), `isInsideReactSelect`.
  - `adapters.js` — `ADAPTERS` array + `pickAdapter()`. Each adapter is a small declarative object: `match(hostname)`, `selectors`, `extraPatterns`, optional `customFill`.
  - `matcher.js` — `PATTERNS` (label/name/id regex → profile key) and `bestMatchIndex` (exact → substring → word-overlap).
  - `labels.js` — `getLabel(el)` for per-field label resolution, adapter-aware.
  - `fillers/` — one file per widget type: `native.js`, `radios.js`, `checkboxes.js`, `react-select.js`, `listbox.js`.
  - `main.js` — mounts the floating button and orchestrates the fillers; runs any `adapter.customFill` last as an escape hatch.

The kernel is ATS-agnostic. ATS-specific quirks (e.g. Lever wrapping question text in `.application-label`) are surfaced through `adapter.selectors`, not hardcoded in fillers.

## ATS-specific caveats

- **Ashby location field** is a Google-Places typeahead. The extension fills the text, but you'll need to click the matching suggestion yourself so Ashby records the structured location.
- **Resume / file uploads** are always skipped on every ATS (Chrome blocks programmatic file attachment).

## Privacy

Your profile lives only in your Chrome profile's sync storage. The extension makes no network requests of its own.

## Adding support for a new ATS

1. Add the host to `host_permissions` and `content_scripts.matches` in `manifest.json`.
2. Add an entry to `ADAPTERS` in `content/adapters.js`. For standard widgets (native inputs, radios, checkboxes, react-select, button-based listboxes), empty `selectors` and `extraPatterns` is enough. If the ATS wraps question text in a non-standard element, set `selectors.questionLabel` to a CSS selector that picks it out.
3. If the ATS has a widget the core doesn't cover (Workday iframes, custom comboboxes), add an async `customFill(profile)` hook on the adapter — it runs after the standard fillers.
4. Drop a saved copy of an application page into `tests/fixtures/` and add a small `fillers.test.js` case asserting which fields should be filled.

## Tests

```
npm install
npm test
```

`tests/matcher.test.js` covers `bestMatchIndex` / `matchKey` / adapter selection offline. `tests/fillers.test.js` loads HTML fixtures into jsdom and runs the fillers against them.
