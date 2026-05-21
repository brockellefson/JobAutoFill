/* JobAutoFill — label resolution for individual fields.
 *
 * Adapter-aware: if the active adapter contributes selectors.questionLabel,
 * that selector is tried first as we walk up the tree. This is how Lever's
 * .application-label is found without hardcoding it in the core.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.getLabel = function getLabel(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent || "";
    }
    const wrap = el.closest("label");
    if (wrap) return wrap.textContent || "";

    const adapter = J.pickAdapter();
    const customSel = adapter.selectors && adapter.selectors.questionLabel;

    // Walk up — many ATSes nest: <div><label>…</label><div>…input…</div></div>
    let parent = el.parentElement;
    for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement) {
      // Adapter-contributed selector wins if it matches a descendant of this row.
      if (customSel) {
        const custom = parent.querySelector(customSel);
        if (custom && !custom.contains(el)) return custom.textContent || "";
      }
      const lbl = parent.querySelector(":scope > label, :scope > div > label");
      if (lbl) return lbl.textContent || "";
      const aria = parent.getAttribute && parent.getAttribute("aria-label");
      if (aria) return aria;
    }
    return el.getAttribute("aria-label") || el.placeholder || "";
  };
})();
