// Popup UI: load profile from chrome.storage.sync, save on click.

const FIELDS = [
  "first_name", "last_name", "preferred_first_name", "email", "phone",
  "location", "country", "pronouns",
  "linkedin", "github", "website", "other_website",
  "current_company", "current_title",
  "work_authorized", "needs_sponsorship", "years_experience",
  "gender", "hispanic_ethnicity", "race", "veteran_status", "disability_status",
  "why_company", "additional_info",
];

const form = document.getElementById("profile-form");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save-btn");

function loadProfile() {
  chrome.storage.sync.get("profile", ({ profile }) => {
    if (!profile) return;
    for (const name of FIELDS) {
      const el = form.elements.namedItem(name);
      if (el && profile[name] != null) el.value = profile[name];
    }
  });
}

function saveProfile() {
  const profile = {};
  for (const name of FIELDS) {
    const el = form.elements.namedItem(name);
    if (el) profile[name] = el.value;
  }
  chrome.storage.sync.set({ profile }, () => {
    statusEl.textContent = "Saved";
    statusEl.classList.add("show");
    setTimeout(() => statusEl.classList.remove("show"), 1500);
  });
}

saveBtn.addEventListener("click", saveProfile);

// Auto-save on blur for convenience
form.addEventListener("change", saveProfile);

document.addEventListener("DOMContentLoaded", loadProfile);
