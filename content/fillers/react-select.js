/* JobAutoFill — react-select (Greenhouse country, demographics) filler.
 *
 * react-select renders a <div> combobox that ignores .value=. We click the
 * control, wait for the menu portal, then click the matching option.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  async function clickReactSelectOption(controlEl, valueText, debugLabel) {
    if (!valueText) return false;

    // Close any open menus so we don't accidentally pick from a stale one.
    if (document.querySelector(".select__control--menu-is-open")) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await J.sleep(80);
    }

    J.fireRealClick(controlEl);
    await J.sleep(300);

    // Walk up from the control looking for THIS control's menu.
    let menu = null;
    let cur = controlEl;
    for (let i = 0; i < 6 && cur && !menu; i++) {
      cur = cur.parentElement;
      if (!cur) break;
      const candidates = cur.querySelectorAll('.select__menu, [role="listbox"]');
      for (const c of candidates) {
        if (c === controlEl || controlEl.contains(c) || c.contains(controlEl)) continue;
        const r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { menu = c; break; }
      }
    }

    if (!menu) {
      console.log("[JobAutoFill] couldn't open dropdown:", debugLabel);
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      return false;
    }

    const options = [...menu.querySelectorAll('[role="option"], .select__option')];

    // Smart numeric match: if the profile value is a bare number and the
    // options are ranges like "5-7 years" or "10+ years", try to find the
    // range that contains the number.
    const num = /^\d+$/.test(valueText.trim()) ? parseInt(valueText.trim(), 10) : null;
    let numericMatch = null;
    if (num !== null) {
      for (const o of options) {
        const t = J.norm(o.textContent);
        const m = t.match(/(\d+)\s*[-–to ]+\s*(\d+)/);
        if (m && num >= +m[1] && num <= +m[2]) { numericMatch = o; break; }
        const p = t.match(/(\d+)\s*\+/);
        if (p && num >= +p[1]) { numericMatch = o; break; }
      }
    }

    const idx = J.bestMatchIndex(valueText, options.map((o) => o.textContent));
    const choice = idx >= 0 ? options[idx] : numericMatch;
    if (!choice) {
      console.log("[JobAutoFill]", debugLabel, "— no option matching", JSON.stringify(valueText),
        "— options:", [...options].slice(0, 8).map((o) => o.textContent.trim()));
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      return false;
    }
    J.fireRealClick(choice);
    await J.sleep(150);
    return true;
  }

  async function processControl(ctrl, profile) {
    // 1) Prefer label[for=innerInputId] — react-select's inner input
    //    usually has the field's real id (e.g. "race", "veteran_status"),
    //    and Greenhouse renders <label for="race">Please identify your race</label>.
    //    The parent-walking fallback can leak across field boundaries.
    const innerInput = ctrl.querySelector("input");
    const innerId = (innerInput && innerInput.id) || "";
    let labelText = "";
    if (innerId) {
      const lbl = document.querySelector(`label[for="${CSS.escape(innerId)}"]`);
      if (lbl) labelText = lbl.textContent || "";
    }
    // 2) Fallback: walk up to a wrapping <label>
    if (!labelText) {
      let p = ctrl.parentElement;
      for (let i = 0; i < 6 && p && !labelText; i++, p = p.parentElement) {
        const l = p.querySelector(":scope > label, :scope > div > label");
        if (l) labelText = l.textContent || "";
      }
    }

    const name = (innerInput && innerInput.name) || "";
    const key = J.matchKey(labelText, name, innerId);
    const debugLbl = (labelText || innerId || name || "?").trim().slice(0, 50);
    if (!key) {
      console.log(`[JobAutoFill] rs[${innerId}] "${debugLbl}" — no PATTERN match, skipping`);
      return false;
    }
    if (!profile[key]) {
      console.log(`[JobAutoFill] rs[${innerId}] "${debugLbl}" — matched key "${key}" but profile.${key} is empty`);
      return false;
    }
    console.log(`[JobAutoFill] rs[${innerId}] "${debugLbl}" — filling with profile.${key} = ${JSON.stringify(profile[key]).slice(0,60)}`);

    const ok = await clickReactSelectOption(ctrl, profile[key], labelText.trim().slice(0, 40));
    await J.sleep(150);
    return ok;
  }

  // Multi-pass fill: some ATSes (Figma's Greenhouse form, for one) lazy-load
  // additional react-selects after earlier ones are filled — e.g. race shows
  // up only after country is picked. After each pass we re-query the DOM and
  // process any controls we haven't seen yet, up to MAX_PASSES.
  J.fillReactSelects = async function fillReactSelects(profile) {
    const MAX_PASSES = 4;
    const SETTLE_MS = 500;
    const processed = new WeakSet();
    let n = 0;

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const all = Array.from(document.querySelectorAll(".select__control"));
      const fresh = all.filter((c) => !processed.has(c));
      if (fresh.length === 0) {
        if (pass > 1) console.log(`[JobAutoFill] fillReactSelects: no new controls after pass ${pass - 1}, stopping`);
        break;
      }
      console.log(`[JobAutoFill] fillReactSelects pass ${pass}: ${fresh.length} new control${fresh.length === 1 ? "" : "s"} (${all.length} total)`);

      for (const ctrl of fresh) {
        processed.add(ctrl);
        if (await processControl(ctrl, profile)) n++;
      }

      // Brief settle window so newly-triggered lazy controls can render before
      // we re-query. If none appear, the next pass exits immediately.
      await J.sleep(SETTLE_MS);
    }
    return n;
  };
})();
