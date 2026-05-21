/* JobAutoFill — radio group filler.
 *
 * Radio groups: find the group's question text (legend, aria-labelledby,
 * adapter-provided selector, or nearest label/heading), then click the
 * matching option.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.fillRadioGroups = function fillRadioGroups(profile) {
    let n = 0;
    const adapter = J.pickAdapter();
    const customSel = adapter.selectors && adapter.selectors.questionLabel;

    const groups = new Map();
    for (const r of document.querySelectorAll('input[type="radio"]')) {
      if (r.disabled) continue;
      const key = r.name || r.getAttribute("aria-labelledby") || "";
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    for (const [groupKey, group] of groups) {
      if (group.length === 0) continue;
      const first = group[0];

      // Find the question text: closest fieldset legend, role="radiogroup"
      // aria-labelledby, adapter-supplied selector, or nearest label/heading.
      let questionText = "";
      let p = first.parentElement;
      for (let i = 0; i < 8 && p && !questionText; i++, p = p.parentElement) {
        if (p.tagName === "FIELDSET") {
          const lg = p.querySelector(":scope > legend");
          if (lg) { questionText = lg.textContent || ""; break; }
        }
        if (p.getAttribute && p.getAttribute("role") === "radiogroup") {
          const al = p.getAttribute("aria-labelledby");
          if (al) {
            const lblEl = document.getElementById(al);
            if (lblEl) { questionText = lblEl.textContent || ""; break; }
          }
        }
        // Adapter-supplied question wrapper (e.g. Lever's .application-label).
        if (customSel) {
          const custom = p.querySelector(customSel);
          if (custom && !custom.contains(first)) {
            questionText = custom.textContent || "";
            break;
          }
        }
        // First label inside this row that isn't wrapping a radio.
        const lbls = p.querySelectorAll(":scope > label, :scope > div > label");
        for (const l of lbls) {
          if (!l.querySelector('input[type="radio"]')) {
            questionText = l.textContent || "";
            break;
          }
        }
        if (questionText) break;
      }

      const profileKey = J.matchKey(questionText, groupKey, "");
      if (!profileKey || !profile[profileKey]) continue;

      // Build option-text array for the group, in DOM order.
      const optTexts = group.map((r) => {
        let lt = "";
        if (r.id) {
          const l = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
          if (l) lt = l.textContent || "";
        }
        if (!lt) {
          const wrap = r.closest("label");
          if (wrap) lt = wrap.textContent || "";
        }
        if (!lt) {
          let sib = r.nextSibling;
          while (sib && !lt) {
            if (sib.nodeType === Node.TEXT_NODE) lt = sib.textContent || "";
            else if (sib.nodeType === Node.ELEMENT_NODE) lt = sib.textContent || "";
            sib = sib.nextSibling;
          }
        }
        return lt;
      });

      const idx = J.bestMatchIndex(profile[profileKey], optTexts);
      if (idx >= 0) {
        const r = group[idx];
        r.click();
        if (!r.checked) {
          const lbl = r.closest("label") ||
            (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`));
          if (lbl) lbl.click();
        }
        n++;
      }
    }
    return n;
  };
})();
