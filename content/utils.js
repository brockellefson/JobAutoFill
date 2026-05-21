/* JobAutoFill — DOM utilities and value setters.
 * Pure helpers with no knowledge of ATSes or profile shape.
 */
(function () {
  const J = (window.__JAF = window.__JAF || {});

  J.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  J.norm = function norm(s) {
    return (s || "")
      .toString()
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[*✱]/g, "")
      .replace(/[\s_\-:?().,\/]+/g, " ")
      .trim();
  };

  // Stopwords ignored when scoring word overlap — common short tokens that
  // appear in nearly every sentence and would inflate match scores.
  J.STOPWORDS = new Set([
    "i", "a", "an", "the", "of", "to", "is", "are", "am", "be", "do", "you",
    "my", "for", "in", "on", "at", "as", "or", "and", "if", "it", "this",
    "that", "with", "have", "has", "had", "your"
  ]);

  J.wordSet = function wordSet(s) {
    return new Set(
      J.norm(s).split(" ").filter((w) => w && !J.STOPWORDS.has(w))
    );
  };

  // React inputs ignore plain `.value=` assignments. Use the prototype setter
  // and dispatch input/change so React picks the change up.
  J.setNativeValue = function setNativeValue(el, value) {
    const tag = el.tagName;
    const proto =
      tag === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : tag === "SELECT"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // react-select v5 ignores stand-alone mousedown events from scripts; it needs
  // the full mouseover/down/up/click chain with which:1, buttons:1 to treat the
  // gesture as a real left click.
  J.fireRealClick = function fireRealClick(el) {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, button: 0 }));
    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        which: 1,
        buttons: 1,
      })
    );
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
  };

  J.isInsideReactSelect = function isInsideReactSelect(el) {
    return !!el.closest(
      '.select__control, [class*="-control"], [class*="select__"], [role="combobox"]'
    );
  };
})();
