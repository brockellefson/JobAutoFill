// jsdom integration tests: load a fixture, run fillers, assert what got filled.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadJAF, loadFixture } from "./load.js";

const PROFILE = {
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  phone: "555-0100",
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
