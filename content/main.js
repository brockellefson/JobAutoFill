/* JobAutoFill — content script orchestrator.
 *
 * Mounts the floating Autofill button, then on click pulls the profile from
 * chrome.storage.sync and runs each filler in order. Any adapter.customFill
 * hook runs last so per-ATS escape hatches (e.g. Workday iframes) can mop up
 * whatever the generic fillers couldn't reach.
 */
(function () {
  if (window.__jobAutoFillLoaded) return;
  window.__jobAutoFillLoaded = true;

  const J = window.__JAF;
  if (!J) {
    console.error("[JobAutoFill] __JAF namespace missing — module load order broken");
    return;
  }

  // ---------- UI ----------

  const btn = document.createElement("button");
  btn.id = "jaf-fill-btn";
  btn.type = "button";
  btn.textContent = "Autofill";
  btn.title = "JobAutoFill — fill from your saved profile";
  btn.addEventListener("click", runAutofill);

  function mountButton() {
    if (document.getElementById("jaf-fill-btn")) return;
    (document.body || document.documentElement).appendChild(btn);
  }
  mountButton();
  // Greenhouse/etc. render late; make sure the button survives client-side re-renders.
  new MutationObserver(mountButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  function toast(message, kind) {
    const t = document.createElement("div");
    t.className = "jaf-toast" + (kind === "error" ? " jaf-toast-error" : "");
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Re-entrancy guard: btn.disabled alone isn't enough because programmatic
  // .click() bypasses the disabled state in some contexts, and a fill can take
  // 10+ seconds with many react-selects. A second run while the first is mid-
  // flight steps on its open dropdowns and can deadlock.
  let filling = false;

  async function runAutofill() {
    if (filling) {
      console.log("[JobAutoFill] fill already in progress — ignoring click");
      return;
    }
    filling = true;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Filling…";
    try {
      const { profile } = await chrome.storage.sync.get("profile");
      if (!profile || !Object.values(profile).some(Boolean)) {
        toast("No profile saved — click the JobAutoFill icon to add one.", "error");
        return;
      }

      const adapter = J.pickAdapter();
      console.log("[JobAutoFill] adapter:", adapter.name);

      const counts = [
        J.fillNativeFields(profile),
        J.fillFullName(profile),
        J.fillRadioGroups(profile),
        J.fillCheckboxGroups(profile),
        await J.fillReactSelects(profile),
        await J.fillButtonDropdowns(profile),
      ];
      if (typeof adapter.customFill === "function") {
        counts.push(await adapter.customFill(profile));
      }

      const total = counts.reduce((a, b) => a + b, 0);
      if (total === 0) {
        toast("Couldn't match any fields on this page.", "error");
      } else {
        toast(`Filled ${total} field${total === 1 ? "" : "s"}. Review before submitting.`);
      }
    } catch (err) {
      console.error("[JobAutoFill]", err);
      toast("Something went wrong — see the console.", "error");
    } finally {
      filling = false;
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
})();
