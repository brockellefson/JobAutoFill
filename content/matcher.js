/* JobAutoFill — field-to-profile-key matching.
 *
 * PATTERNS maps profile keys to regexes tested against a field's label, name,
 * and id. Order matters — more specific patterns first.
 *
 * bestMatchIndex finds the option in a list that best matches a target value:
 * exact → substring → word-overlap (Jaccard-ish on non-stopword tokens).
 *
 * Adapters can contribute extraPatterns; those are appended after the core
 * patterns so adapters can add fields without overriding core matches.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  // Order matters — more specific patterns first.
  J.PATTERNS = [
    { key: "preferred_first_name", tests: [/preferred (first )?name/] },
    { key: "first_name", tests: [/^first name$/, /given name/, /\bfirst name\b/] },
    { key: "last_name", tests: [/^last name$/, /family name|surname/, /\blast name\b/] },
    { key: "email", tests: [/^e ?mail/] },
    { key: "phone", tests: [/^phone( number)?$/, /telephone/, /mobile (number|phone)/, /^phone$/] },
    { key: "location", tests: [/where.*intend.*work/, /location.*city/, /^city$/, /current location/, /location \(city\)/] },
    { key: "country", tests: [/^country$/] },
    { key: "pronouns", tests: [/pronoun/] },
    { key: "linkedin", tests: [/linkedin/] },
    { key: "github", tests: [/github/] },
    { key: "website", tests: [/portfolio/, /personal (web)?site/, /^website$/, /website url/] },
    { key: "other_website", tests: [/other website/, /other url/, /other link/] },
    { key: "work_authorized", tests: [/authori[sz]ed to work/, /legally authori[sz]ed/, /right to work/, /us citizen.*permanent resident/, /citizen or permanent resident/, /eligible to work/] },
    { key: "needs_sponsorship", tests: [/sponsorship/, /\bvisa\b/, /require.*sponsor/] },
    { key: "years_experience", tests: [/years of (professional )?experience/, /how many years/] },
    { key: "gender", tests: [/^gender$/, /gender identity/, /\bgender\b/] },
    { key: "hispanic_ethnicity", tests: [/hispanic/, /latino/, /latinx/] },
    { key: "race", tests: [/^race$/, /race.*ethnicity/, /^ethnicity$/, /identify your race/, /\brace\b/, /identify .* ethnicity/, /\bethnicity\b/] },
    { key: "veteran_status", tests: [/veteran/] },
    { key: "disability_status", tests: [/disability/] },
    { key: "current_company", tests: [/current (or most recent )?company/, /^company$/, /^employer$/, /current employer/] },
    { key: "current_title", tests: [/current (or most recent )?(job )?title/, /^job title$/, /current position/] },
    { key: "why_company", tests: [/why.*(join|interested|want)/, /why do you want/] },
    { key: "additional_info", tests: [/additional info/, /cover letter/, /anything else/] },
  ];

  function activePatterns() {
    const adapter = J.pickAdapter ? J.pickAdapter() : null;
    const extra = adapter && adapter.extraPatterns ? adapter.extraPatterns : [];
    return extra.length ? [...J.PATTERNS, ...extra] : J.PATTERNS;
  }

  J.matchKey = function matchKey(label, name, id) {
    // Test each candidate (label / name / id) separately. Concatenating with
    // spaces breaks anchored regexes — e.g. label "Phone*" and id "phone"
    // become "phone phone", which /^phone$/ can't match.
    const candidates = [J.norm(label), J.norm(name || ""), J.norm(id || "")].filter(Boolean);
    if (candidates.length === 0) return null;
    for (const p of activePatterns()) {
      for (const re of p.tests) {
        for (const c of candidates) {
          if (re.test(c)) return p.key;
        }
      }
    }
    return null;
  };

  // Given a target value and a list of option text strings, return the option
  // index that best matches: exact > substring > word-overlap. Returns -1 if
  // no meaningful match.
  J.bestMatchIndex = function bestMatchIndex(targetText, optionTexts) {
    if (!targetText) return -1;
    const target = J.norm(targetText);
    if (!target) return -1;

    let exact = -1;
    let partial = -1;
    for (let i = 0; i < optionTexts.length; i++) {
      const t = J.norm(optionTexts[i]);
      if (!t) continue;
      if (t === target) { exact = i; break; }
      if (partial === -1 && (t.includes(target) || target.includes(t))) partial = i;
    }
    if (exact >= 0) return exact;
    if (partial >= 0) return partial;

    // Word-overlap fallback. Useful when ATSes phrase the same answer
    // differently — e.g. profile "I am not a protected veteran" vs option
    // "I am not a veteran".
    const targetWords = J.wordSet(targetText);
    if (targetWords.size === 0) return -1;
    let bestScore = 0;
    let bestIdx = -1;
    for (let i = 0; i < optionTexts.length; i++) {
      const ow = J.wordSet(optionTexts[i]);
      if (ow.size === 0) continue;
      let overlap = 0;
      for (const w of targetWords) if (ow.has(w)) overlap++;
      // Jaccard-ish: overlap divided by smaller set, so a 2-word option that
      // matches the 2 key words from a 6-word target scores well.
      const score = overlap / Math.min(targetWords.size, ow.size);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    // Require at least 60% of the smaller side to overlap.
    return bestScore >= 0.6 ? bestIdx : -1;
  };
})();
