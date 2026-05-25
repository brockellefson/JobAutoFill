// Offline unit tests for the matcher — no DOM needed beyond jsdom's globals.
import { describe, it, expect, beforeAll } from "vitest";
import { loadJAF } from "./load.js";

let J;
beforeAll(() => {
  J = loadJAF();
});

describe("norm", () => {
  it("lowercases, collapses whitespace, strips punctuation and asterisks", () => {
    expect(J.norm("First Name*")).toBe("first name");
    expect(J.norm("  Phone _ Number ?  ")).toBe("phone number");
    expect(J.norm("Year’s of experience")).toBe("year's of experience");
  });

  it("returns empty string for nullish input", () => {
    expect(J.norm(null)).toBe("");
    expect(J.norm(undefined)).toBe("");
  });
});

describe("matchKey", () => {
  it("matches anchored regexes against label OR name OR id, not their concatenation", () => {
    // This was the bug that prompted the candidate-array split — label "Phone*"
    // + id "phone" used to collapse to "phone phone" and miss /^phone$/.
    expect(J.matchKey("Phone*", "", "phone")).toBe("phone");
    expect(J.matchKey("Phone Number", "", "")).toBe("phone");
  });

  it("prefers more specific patterns when both could match", () => {
    // preferred_first_name pattern sits before first_name in PATTERNS.
    expect(J.matchKey("Preferred First Name", "", "")).toBe("preferred_first_name");
    expect(J.matchKey("First Name", "", "")).toBe("first_name");
  });

  it("matches demographic questions", () => {
    expect(J.matchKey("Please identify your race", "", "race")).toBe("race");
    expect(J.matchKey("Veteran Status", "", "")).toBe("veteran_status");
    expect(J.matchKey("Are you of Hispanic or Latino origin?", "", "")).toBe("hispanic_ethnicity");
  });

  it("returns null when no pattern matches", () => {
    expect(J.matchKey("What's your favorite color?", "", "")).toBeNull();
  });

  // Ashby uses bare labels like "Git link" and "Location" that the original
  // PATTERNS missed. Make sure both still resolve along with the existing
  // GitHub / "Location (City)" / "Where do you intend to work" forms.
  it("matches Ashby-style bare labels for github and location", () => {
    expect(J.matchKey("Git link", "", "")).toBe("github");
    expect(J.matchKey("Git URL", "", "")).toBe("github");
    expect(J.matchKey("Git", "", "")).toBe("github");
    expect(J.matchKey("GitHub", "", "")).toBe("github");
    expect(J.matchKey("Location", "", "")).toBe("location");
    expect(J.matchKey("Location (City)", "", "")).toBe("location");
    expect(J.matchKey("Current Location", "", "")).toBe("location");
  });
});

describe("bestMatchIndex", () => {
  it("returns -1 for empty target", () => {
    expect(J.bestMatchIndex("", ["a", "b"])).toBe(-1);
    expect(J.bestMatchIndex(null, ["a", "b"])).toBe(-1);
  });

  it("finds exact matches case-insensitively", () => {
    expect(J.bestMatchIndex("Yes", ["No", "Yes", "Maybe"])).toBe(1);
  });

  it("prefers exact over substring", () => {
    // "no" appears as substring of "i am not a veteran" (index 1) but as an
    // exact match at index 2 — exact should win.
    const opts = ["yes", "I am not a veteran", "no"];
    expect(J.bestMatchIndex("no", opts)).toBe(2);
  });

  it("falls back to word-overlap with stopword filtering", () => {
    // Profile value "I am not a protected veteran" vs option "I am not a veteran"
    // — overlap on {not, protected, veteran} / {not, veteran} after stopwords.
    const idx = J.bestMatchIndex(
      "I am not a protected veteran",
      ["I identify as a protected veteran", "I am not a veteran", "I prefer not to answer"]
    );
    expect(idx).toBe(1);
  });

  it("returns -1 when word-overlap is below threshold", () => {
    const idx = J.bestMatchIndex("Software Engineer", ["Marketing Manager", "Sales Lead"]);
    expect(idx).toBe(-1);
  });
});

describe("adapters", () => {
  it("picks lever for jobs.lever.co", () => {
    expect(J.pickAdapter("jobs.lever.co").name).toBe("lever");
  });

  it("picks ashby for jobs.ashbyhq.com", () => {
    expect(J.pickAdapter("jobs.ashbyhq.com").name).toBe("ashby");
  });

  it("picks greenhouse for both greenhouse hosts", () => {
    expect(J.pickAdapter("job-boards.greenhouse.io").name).toBe("greenhouse");
    expect(J.pickAdapter("boards.greenhouse.io").name).toBe("greenhouse");
  });

  it("picks workable for apply.workable.com", () => {
    expect(J.pickAdapter("apply.workable.com").name).toBe("workable");
  });

  it("falls back to generic for unknown hosts", () => {
    expect(J.pickAdapter("example.com").name).toBe("generic");
  });

  it("lever adapter exposes the .application-label selector", () => {
    const lever = J.pickAdapter("jobs.lever.co");
    expect(lever.selectors.questionLabel).toContain("application-label");
  });
});
