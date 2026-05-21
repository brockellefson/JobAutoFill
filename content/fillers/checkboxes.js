/* JobAutoFill — checkbox group filler.
 *
 * Lever renders Pronouns and Ethnicity as checkbox groups. Find each group,
 * identify it from its heading text, then tick each checkbox whose label
 * matches the profile value. Profile values can be comma-separated to pick
 * multiple options (handy for "select all that apply" race fields).
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.fillCheckboxGroups = function fillCheckboxGroups(profile) {
    let n = 0;
    const adapter = J.pickAdapter();
    const customSel = adapter.selectors && adapter.selectors.questionLabel;

    const groups = new Map();
    for (const c of document.querySelectorAll('input[type="checkbox"]')) {
      if (c.disabled || !c.offsetParent) continue;
      const key = c.name || "";
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }

    for (const [groupName, group] of groups) {
      if (group.length === 0) continue;
      // Skip single-checkbox cases (consent toggles etc.)
      if (group.length === 1) continue;

      const first = group[0];
      // Find a heading describing the group. Most ATSes have h2/h3/h4 nearby;
      // adapters can also supply a selector for their question wrapper.
      let heading = "";
      let p = first.parentElement;
      for (let i = 0; i < 10 && p && !heading; i++, p = p.parentElement) {
        if (p.tagName === "FIELDSET") {
          const lg = p.querySelector(":scope > legend");
          if (lg) { heading = lg.textContent || ""; break; }
        }
        if (customSel) {
          const custom = p.querySelector(customSel);
          if (custom && !custom.contains(first)) {
            heading = custom.textContent || "";
            break;
          }
        }
        const h = p.querySelector(":scope > h2, :scope > h3, :scope > h4");
        if (h && !h.contains(first)) { heading = h.textContent || ""; break; }
        const sib = p.previousElementSibling;
        if (sib && /^H[1-6]$/.test(sib.tagName)) { heading = sib.textContent || ""; break; }
      }

      const key = J.matchKey(heading, groupName, "");
      if (!key || !profile[key]) continue;

      // Profile value may be a single string or comma-separated for multi-select.
      const targets = String(profile[key])
        .split(",")
        .map((s) => J.norm(s))
        .filter(Boolean);
      if (targets.length === 0) continue;

      let pickedAny = false;
      for (const cb of group) {
        let lt = "";
        if (cb.id) {
          const l = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
          if (l) lt = l.textContent || "";
        }
        if (!lt) {
          const wrap = cb.closest("label");
          if (wrap) lt = wrap.textContent || "";
        }
        const lt2 = J.norm(lt);
        if (!lt2) continue;
        const matches = targets.some((t) => lt2 === t || lt2.includes(t) || t.includes(lt2));
        if (matches && !cb.checked) {
          cb.click();
          pickedAny = true;
        }
      }
      if (pickedAny) n++;
    }
    return n;
  };
})();
