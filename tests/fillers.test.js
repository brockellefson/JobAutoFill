// jsdom integration tests: load a fixture, run fillers, assert what got filled.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadJAF, loadFixture } from "./load.js";

const PROFILE = {
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  phone: "555-0100",
  location: "San Francisco, CA",
  linkedin: "https://linkedin.com/in/ada",
  github: "https://github.com/ada",
  website: "https://ada.example",
  work_authorized: "Yes",
  needs_sponsorship: "No",
  why_company: "Excited about the mission.",
};

describe("Greenhouse-shape form", () => {
  let J;
  beforeEach(() => {
    J = loadJAF();
    // Force the generic adapter — no host context in jsdom.
    Object.defineProperty(window, "location", {
      value: new URL("https://job-boards.greenhouse.io/acme/jobs/123"),
      configurable: true,
    });
    loadFixture("greenhouse-minimal.html");
  });

  it("fills basic identity + link + text fields", () => {
    const n = J.fillNativeFields(PROFILE);
    expect(document.getElementById("first_name").value).toBe("Ada");
    expect(document.getElementById("last_name").value).toBe("Lovelace");
    expect(document.getElementById("email").value).toBe("ada@example.com");
    expect(document.getElementById("phone").value).toBe("555-0100");
    expect(document.getElementById("linkedin").value).toBe("https://linkedin.com/in/ada");
    expect(document.getElementById("github").value).toBe("https://github.com/ada");
    expect(document.getElementById("website").value).toBe("https://ada.example");
    expect(document.getElementById("why").value).toBe("Excited about the mission.");
    expect(n).toBeGreaterThanOrEqual(8);
  });

  it("answers radio groups by legend text", () => {
    const n = J.fillRadioGroups(PROFILE);
    const workYes = document.querySelector('input[name="q_work_auth"][value="yes"]');
    const sponsorNo = document.querySelector('input[name="q_sponsorship"][value="no"]');
    expect(workYes.checked).toBe(true);
    expect(sponsorNo.checked).toBe(true);
    expect(n).toBe(2);
  });
});

describe("Lever-shape form", () => {
  let J;
  beforeEach(() => {
    J = loadJAF();
    Object.defineProperty(window, "location", {
      value: new URL("https://jobs.lever.co/acme/123"),
      configurable: true,
    });
    loadFixture("lever-minimal.html");
  });

  it("finds question text via Lever's .application-label selector", () => {
    // The adapter contributes .application-label as the questionLabel selector;
    // getLabel walks up the tree and finds the span.
    const firstNameInput = document.querySelector('input[name="cards[abc][first]"]');
    expect(J.getLabel(firstNameInput).trim()).toBe("First name");

    const lastNameInput = document.querySelector('input[name="cards[abc][last]"]');
    expect(J.getLabel(lastNameInput).trim()).toBe("Last name");
  });

  it("fills native fields whose questions live in .application-label spans", () => {
    J.fillNativeFields(PROFILE);
    expect(document.querySelector('input[name="cards[abc][first]"]').value).toBe("Ada");
    expect(document.querySelector('input[name="cards[abc][last]"]').value).toBe("Lovelace");
    expect(document.querySelector('input[name="cards[abc][email]"]').value).toBe("ada@example.com");
  });

  it("answers Lever radio groups using the .application-label heading", () => {
    const n = J.fillRadioGroups(PROFILE);
    const yes = document.querySelector('input[name="cards[lever][q1]"][value="yes"]');
    expect(yes.checked).toBe(true);
    expect(n).toBe(1);
  });
});

// Ashby renders Yes/No (and similar small-choice) questions as a pair of
// plain <button>s plus a hidden React-state <input type="checkbox" tabindex="-1">.
// The label's `for=` points to a non-existent id, so radios.js, listbox.js,
// native.js, react-select.js, and checkboxes.js all miss it. The Ashby
// adapter's customFill (fillAshbyButtonChoices) handles it.
describe("Ashby Yes/No button widget", () => {
  let J;
  beforeEach(() => {
    J = loadJAF();
    Object.defineProperty(window, "location", {
      value: new URL("https://jobs.ashbyhq.com/acme/abc/application"),
      configurable: true,
    });
    loadFixture("ashby-minimal.html");
  });

  it("clicks the matching button for sponsorship and work-authorization questions", async () => {
    // jsdom doesn't implement PointerEvent; the filler guards that, but make
    // sure missing PointerEvent doesn't make the test crash.
    expect(typeof J.fillAshbyButtonChoices).toBe("function");

    // Track which buttons get clicked so we can assert *which* one was picked,
    // not just that something was clicked. (jsdom doesn't have CSS-driven
    // active-state visuals.)
    const clicked = [];
    for (const b of document.querySelectorAll("button")) {
      b.addEventListener("click", () => clicked.push(b.dataset.testid));
    }

    const n = J.fillAshbyButtonChoices(PROFILE);
    expect(n).toBe(2);
    // needs_sponsorship: "No" → click the "No" button on the sponsorship row.
    expect(clicked).toContain("no-btn");
    expect(clicked).not.toContain("yes-btn");
    // work_authorized: "Yes" → click the "Yes" button on the auth row.
    expect(clicked).toContain("auth-yes-btn");
    expect(clicked).not.toContain("auth-no-btn");
  });

  it("ignores entries with no button-choice widget", () => {
    // The Name entry is a plain text input — must not be touched.
    const clicked = [];
    for (const b of document.querySelectorAll("button")) {
      b.addEventListener("click", () => clicked.push(b.dataset.testid));
    }
    J.fillAshbyButtonChoices(PROFILE);
    // Only the two Yes/No groups; nothing else.
    expect(clicked.length).toBe(2);
    // The text input must remain untouched.
    expect(document.getElementById("_systemfield_name").value).toBe("");
  });

  it("does nothing when profile has no value for the matched key", () => {
    const clicked = [];
    for (const b of document.querySelectorAll("button")) {
      b.addEventListener("click", () => clicked.push(b.dataset.testid));
    }
    const n = J.fillAshbyButtonChoices({ first_name: "Ada" });
    expect(n).toBe(0);
    expect(clicked).toEqual([]);
  });

  it("fills Git link and Location text inputs via fillNativeFields", () => {
    const n = J.fillNativeFields(PROFILE);
    const gitInput = document.getElementById("4e929e78-fc28-4ffe-8d80-c01acde01481");
    expect(gitInput.value).toBe("https://github.com/ada");
    // Location is the only role="combobox" input in the fixture — the
    // earlier isInsideReactSelect false positive made it skip this field.
    const locInput = document.querySelector('input[role="combobox"]');
    expect(locInput.value).toBe("San Francisco, CA");
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it("is wired up as the Ashby adapter's customFill", async () => {
    // Sanity-check the adapter selection + customFill plumbing — the bug we
    // shipped without this filler returned 0 from runAutofill.
    const adapter = J.pickAdapter();
    expect(adapter.name).toBe("ashby");
    expect(typeof adapter.customFill).toBe("function");
    const n = await adapter.customFill(PROFILE);
    expect(n).toBe(2);
  });
});

// Regression: Figma's Greenhouse form lazy-loads the race react-select only
// after country gets filled. The first pass over .select__control therefore
// missed race entirely. fillReactSelects now re-queries the DOM after each
// pass and processes any newly appeared controls.
describe("fillReactSelects multi-pass (lazy-loaded controls)", () => {
  let J;
  let logs;
  let origLog;
  let origSleep;

  beforeEach(() => {
    J = loadJAF();
    Object.defineProperty(window, "location", {
      value: new URL("https://job-boards.greenhouse.io/acme/jobs/123"),
      configurable: true,
    });
    document.documentElement.innerHTML = "<head></head><body></body>";

    logs = [];
    origLog = console.log;
    console.log = (...args) => { logs.push(args.map(String).join(" ")); };

    // Skip real delays — the pass orchestration is what we're testing.
    origSleep = J.sleep;
  });

  afterEach(() => {
    console.log = origLog;
    J.sleep = origSleep;
  });

  function addControl(id, labelText) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML =
      `<label for="${id}">${labelText}</label>` +
      `<div class="select__control"><input id="${id}" type="text" /></div>`;
    document.body.appendChild(wrapper);
  }

  it("picks up a control that appears between passes", async () => {
    // Use labels that don't match any PATTERN so processControl returns
    // immediately without hitting clickReactSelectOption (which expects a
    // real react-select runtime to open a menu).
    addControl("custom_q_1", "Some Custom Question");

    let sleepCalls = 0;
    J.sleep = () => {
      sleepCalls++;
      // After pass 1's settle window, simulate the page lazy-loading a new
      // control — exactly what Figma's form does for race after country.
      if (sleepCalls === 1) addControl("custom_q_2", "Another Custom Question");
      return Promise.resolve();
    };

    await J.fillReactSelects({});

    const passLogs = logs.filter((l) => /fillReactSelects pass \d+:/.test(l));
    expect(passLogs.length).toBe(2);
    expect(passLogs[0]).toContain("pass 1: 1 new control");
    expect(passLogs[1]).toContain("pass 2: 1 new control");
    expect(logs.some((l) => l.includes("custom_q_1"))).toBe(true);
    expect(logs.some((l) => l.includes("custom_q_2"))).toBe(true);
  });

  it("stops cleanly when no new controls appear", async () => {
    addControl("custom_q_1", "Some Custom Question");
    J.sleep = () => Promise.resolve();

    await J.fillReactSelects({});

    const passLogs = logs.filter((l) => /fillReactSelects pass \d+:/.test(l));
    expect(passLogs.length).toBe(1);
    expect(logs.some((l) => l.includes("no new controls after pass 1, stopping"))).toBe(true);
  });

  it("caps at MAX_PASSES even if controls keep appearing", async () => {
    addControl("q1", "Q1");
    let sleepCalls = 0;
    J.sleep = () => {
      sleepCalls++;
      // Add a new control every pass — should still stop at MAX_PASSES (4).
      addControl(`q${sleepCalls + 1}`, `Q${sleepCalls + 1}`);
      return Promise.resolve();
    };

    await J.fillReactSelects({});

    const passLogs = logs.filter((l) => /fillReactSelects pass \d+:/.test(l));
    expect(passLogs.length).toBe(4);
  });
});
