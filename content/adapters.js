/* JobAutoFill — per-ATS adapters.
 *
 * Each adapter is a small declarative object. The kernel (fillers + matcher)
 * is generic; adapters only need to contribute what is genuinely ATS-specific:
 *
 *   - match(hostname): does this adapter apply to the current page?
 *   - selectors.questionLabel: CSS selector for the element that contains the
 *       question text for a field/group. Used by getLabel, fillRadioGroups,
 *       and fillCheckboxGroups when the ATS uses a non-standard wrapper for
 *       question text (e.g. Lever's .application-label).
 *   - extraPatterns: optional [{ key, tests: [regex…] }] appended to the core
 *       PATTERNS list. Use for fields that only one ATS asks about.
 *   - customFill(profile): async escape hatch that runs after the standard
 *       fillers. Use for sites that have widgets the core doesn't cover
 *       (e.g. Workday's iframe-y forms). Should return the number of fields
 *       filled.
 *
 * To add a new ATS:
 *   1. Add host entries to manifest.json (host_permissions + content_scripts.matches).
 *   2. Add an entry to ADAPTERS below.
 *   3. If standard widgets aren't enough, add a customFill hook.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.ADAPTERS = [
    {
      name: "greenhouse",
      match: (h) => h.endsWith("greenhouse.io"),
      selectors: {},
      extraPatterns: [],
    },
    {
      name: "ashby",
      match: (h) => h.endsWith("ashbyhq.com"),
      selectors: {},
      extraPatterns: [],
      // Note: Ashby's location field is a Google Places typeahead. The
      // generic native filler sets the text; the user accepts the suggestion.
    },
    {
      name: "lever",
      match: (h) => h === "jobs.lever.co" || h.endsWith(".lever.co"),
      selectors: {
        // Lever wraps each question's text in .application-label inside an
        // <li class="application-question">. Surface that here so getLabel,
        // fillRadioGroups, and fillCheckboxGroups all find it.
        questionLabel:
          ".application-label, label.application-label, .application-question .application-label",
      },
      extraPatterns: [],
    },
    {
      name: "workable",
      match: (h) => h.endsWith("workable.com"),
      selectors: {},
      extraPatterns: [],
    },
    // Fallback — kernel-only behavior. Always present, always last.
    {
      name: "generic",
      match: () => true,
      selectors: {},
      extraPatterns: [],
    },
  ];

  J.pickAdapter = function pickAdapter(hostname) {
    const h = hostname || (typeof location !== "undefined" ? location.hostname : "");
    return J.ADAPTERS.find((a) => a.match(h)) || J.ADAPTERS[J.ADAPTERS.length - 1];
  };
})();
