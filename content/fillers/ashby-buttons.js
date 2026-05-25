/* JobAutoFill — Ashby button-choice widget filler.
 *
 * Ashby renders Yes/No (and similar small-choice) questions as a div
 * containing plain <button> elements:
 *
 *   <div class="ashby-application-form-field-entry">
 *     <label class="ashby-application-form-question-title" for="GUID">Question?</label>
 *     <div class="_container_… _yesno_…">
 *       <button>Yes</button><button>No</button>
 *     </div>
 *     <input type="checkbox" name="GUID" tabindex="-1" />  <!-- React state -->
 *   </div>
 *
 * The visible buttons have no name/id/role, the label's `for` points to a
 * GUID that no element actually owns, and the only real <input> is a hidden
 * checkbox that holds form state (clicking the buttons is what flips it via
 * React). So radios.js, listbox.js, native.js, react-select.js, and
 * checkboxes.js all miss it. This filler handles it.
 *
 * Detection looks for a container *inside* the entry whose direct children
 * are all <button>s with short text, rather than trying to rule out the
 * entry by absence of other inputs — Ashby keeps that state checkbox around.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  function getQuestionText(entry) {
    const q = entry.querySelector(".ashby-application-form-question-title");
    if (q) return q.textContent || "";
    // Fallback: first label inside the entry that doesn't wrap an input.
    for (const l of entry.querySelectorAll("label")) {
      if (!l.querySelector("input, select, textarea")) return l.textContent || "";
    }
    return "";
  }

  // A non-button sibling of the choice buttons is allowed if it's a React state
  // input — Ashby keeps a hidden checkbox alongside the buttons to hold form
  // state. Any other element disqualifies the container.
  function isStateSibling(el) {
    if (el.tagName !== "INPUT") return false;
    const ti = el.getAttribute("tabindex");
    if (ti === "-1") return true;
    return el.type === "hidden" || el.type === "checkbox";
  }

  // Find a div whose direct children are 2+ <button>s with short non-empty text
  // and no other widgets (only allowed sibling: a React state input). That's
  // the Yes/No (or similar) choice container.
  function findChoiceButtons(entry) {
    for (const div of entry.querySelectorAll("div")) {
      const kids = Array.from(div.children);
      if (kids.length < 2 || kids.length > 10) continue;
      const buttons = kids.filter((k) => k.tagName === "BUTTON" && !k.disabled);
      if (buttons.length < 2) continue;
      const others = kids.filter((k) => k.tagName !== "BUTTON");
      if (!others.every(isStateSibling)) continue;
      const ok = buttons.every((b) => {
        const t = (b.textContent || "").trim();
        return t.length > 0 && t.length <= 60;
      });
      if (ok) return buttons;
    }
    return null;
  }

  J.fillAshbyButtonChoices = function fillAshbyButtonChoices(profile) {
    let n = 0;
    const entries = document.querySelectorAll(".ashby-application-form-field-entry");
    for (const entry of entries) {
      const btns = findChoiceButtons(entry);
      if (!btns) continue;

      const labelText = getQuestionText(entry);
      const key = J.matchKey(labelText, "", "");
      if (!key || !profile[key]) continue;

      const idx = J.bestMatchIndex(profile[key], btns.map((b) => b.textContent));
      if (idx < 0) {
        console.log(
          "[JobAutoFill] ashby button-choice — no option matching",
          JSON.stringify(profile[key]),
          "for",
          labelText.trim().slice(0, 60),
          "options:",
          btns.map((b) => (b.textContent || "").trim())
        );
        continue;
      }

      const choice = btns[idx];
      // Ashby's button onClick handlers don't fire from a synthetic MouseEvent
      // chain (mouseover/mousedown/mouseup/click) — that's what J.fireRealClick
      // does, and it's a no-op here. Native HTMLElement.click() works once the
      // page is hydrated. Send pointerdown/pointerup first as a hedge for
      // builds that listen specifically to pointer events. The buttons are
      // sometimes type="submit" but live outside any <form>, so they won't
      // submit anything.
      try {
        choice.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0 }));
        choice.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0 }));
      } catch (_) { /* PointerEvent may not exist in some test envs */ }
      choice.click();
      n++;
    }
    return n;
  };
})();
