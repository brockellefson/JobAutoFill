/* JobAutoFill — button-based listbox dropdown filler.
 *
 * Ashby and similar use <button aria-haspopup="listbox"> that opens a portal
 * [role="listbox"] in document.body. Click trigger, click matching option.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.fillButtonDropdowns = async function fillButtonDropdowns(profile) {
    let n = 0;
    const triggers = document.querySelectorAll(
      'button[aria-haspopup="listbox"], [role="combobox"][aria-haspopup="listbox"], [role="combobox"]:not(input)'
    );

    const seen = new Set();
    for (const trig of triggers) {
      if (seen.has(trig)) continue;
      seen.add(trig);
      // Don't double-handle controls that already belong to a react-select group
      if (trig.closest('.select__control, [class*="-control"]')) continue;
      if (trig.tagName === "INPUT") continue;

      // Find label text
      let labelText = "";
      if (trig.id) {
        const l = document.querySelector(`label[for="${CSS.escape(trig.id)}"]`);
        if (l) labelText = l.textContent || "";
      }
      if (!labelText) {
        const al = trig.getAttribute("aria-labelledby");
        if (al) {
          for (const id of al.split(/\s+/)) {
            const el = document.getElementById(id);
            if (el) labelText += " " + (el.textContent || "");
          }
        }
      }
      if (!labelText) labelText = trig.getAttribute("aria-label") || "";
      if (!labelText) {
        let p = trig.parentElement;
        for (let i = 0; i < 6 && p && !labelText; i++, p = p.parentElement) {
          const l = p.querySelector(":scope > label, :scope > div > label");
          if (l) labelText = l.textContent || "";
        }
      }

      const key = J.matchKey(labelText, trig.name || "", trig.id || "");
      if (!key || !profile[key]) continue;

      // Snapshot listboxes already open so we can pick the new one
      const before = new Set(document.querySelectorAll('[role="listbox"]'));

      J.fireRealClick(trig);
      await J.sleep(220);

      const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
      let lb = listboxes.find((l) => !before.has(l));
      if (!lb) {
        // Maybe it was already open or rendered in place — pick the visible one
        for (const l of listboxes) {
          const r = l.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) lb = l;
        }
      }
      if (!lb) {
        document.body.click();
        continue;
      }

      const opts = [...lb.querySelectorAll('[role="option"], li')];
      const idx = J.bestMatchIndex(profile[key], opts.map((o) => o.textContent));
      const choice = idx >= 0 ? opts[idx] : null;
      if (choice) {
        J.fireRealClick(choice);
        n++;
      } else {
        // Close it via Escape; clicking body sometimes selects nothing harmlessly
        trig.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        document.body.click();
      }
      await J.sleep(150);
    }
    return n;
  };
})();
