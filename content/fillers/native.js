/* JobAutoFill — native <input>/<textarea>/<select> filler.
 *
 * fillFullName runs after fillNativeFields so it only catches the "Name" /
 * "Full Name" fields that the per-field pass didn't already fill (e.g. Ashby).
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  function setNativeSelect(el, valueText) {
    if (!valueText) return false;
    const opts = [...el.options];
    const idx = J.bestMatchIndex(valueText, opts.map((o) => o.textContent));
    if (idx < 0) return false;
    J.setNativeValue(el, opts[idx].value);
    return true;
  }

  J.fillNativeFields = function fillNativeFields(profile) {
    let n = 0;

    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea'
    );
    for (const el of inputs) {
      if (el.disabled || el.readOnly) continue;
      if (J.isInsideReactSelect(el)) continue; // these are search inputs, not real fields
      const key = J.matchKey(J.getLabel(el), el.name, el.id);
      if (key && profile[key]) {
        J.setNativeValue(el, profile[key]);
        n++;
      }
    }

    for (const sel of document.querySelectorAll("select")) {
      if (sel.disabled) continue;
      const key = J.matchKey(J.getLabel(sel), sel.name, sel.id);
      if (key && profile[key]) {
        if (setNativeSelect(sel, profile[key])) n++;
      }
    }
    return n;
  };

  // Ashby and similar use a single "Name" / "Full Name" field instead of
  // split first/last. Run after fillNativeFields so we only catch what wasn't
  // already filled.
  J.fillFullName = function fillFullName(profile) {
    if (!profile.first_name && !profile.last_name) return 0;
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    if (!fullName) return 0;

    let n = 0;
    const inputs = document.querySelectorAll(
      'input[type="text"], input:not([type]), input[type="search"]'
    );
    for (const el of inputs) {
      if (el.disabled || el.readOnly) continue;
      if (J.isInsideReactSelect(el)) continue;
      if (el.value) continue; // already filled (by native pass or by user)
      const label = J.norm(J.getLabel(el));
      // Skip if this is a first/last/preferred/company/legal/middle/etc. name
      if (/\b(first|last|preferred|legal|company|maiden|middle|nick|user|file)\b/.test(label)) continue;
      if (/^full name$/.test(label) || /^name$/.test(label) || /^your name$/.test(label)) {
        J.setNativeValue(el, fullName);
        n++;
      }
    }
    return n;
  };
})();
