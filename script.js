const nav = document.getElementById("categories");
const promptEl = document.getElementById("prompt");
const actions = document.getElementById("actions");
const anotherBtn = document.getElementById("another");
const copyBtn = document.getElementById("copy");

let currentCategory = null;
let currentPrompt = "";

// Build category buttons from prompts.js
Object.keys(PROMPTS).forEach((name) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = name;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => selectCategory(name));
  nav.appendChild(b);
});

function selectCategory(name) {
  currentCategory = name;
  [...nav.children].forEach((b) =>
    b.setAttribute("aria-pressed", String(b.textContent === name))
  );
  showPrompt();
}

function showPrompt() {
  const list = PROMPTS[currentCategory];
  let next;
  do {
    next = list[Math.floor(Math.random() * list.length)];
  } while (next === currentPrompt && list.length > 1);
  currentPrompt = next;
  promptEl.textContent = next;
  promptEl.classList.remove("empty");
  actions.hidden = false;
  copyBtn.textContent = "Copy";
  onQuestionChange();
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(currentPrompt);
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = currentPrompt;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1800);
}

anotherBtn.addEventListener("click", showPrompt);
copyBtn.addEventListener("click", copyPrompt);

// ---- Prompt of the Day ----
// Same prompt all day (based on the visitor's local date), new one at midnight.
// Cycles through the categories daily; no repeats until every prompt has been used.
(function showDailyPrompt() {
  const now = new Date();
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
  );
  const categories = Object.keys(PROMPTS);
  const category = categories[dayNumber % categories.length];
  const list = PROMPTS[category];
  const prompt = list[Math.floor(dayNumber / categories.length) % list.length];

  const dateText = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  document.getElementById("daily-meta").textContent = dateText + ", " + category;
  document.getElementById("daily-prompt").textContent = prompt;
})();

// ---- Supabase connection ----
// Uses only the public (publishable) key from config.js. Row Level Security in
// Supabase decides what visitors may do. Nothing secret lives in this site, and
// no visitor session is stored in the browser.
const db =
  window.supabase && SUPABASE_URL && SUPABASE_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

// ---- Leaving a thought ----
const respond = document.getElementById("respond");
const responseBox = document.getElementById("response");
const counterEl = document.getElementById("counter");
const leaveBtn = document.getElementById("leave");
const statusEl = document.getElementById("respond-status");
const drafts = {}; // unsent words, remembered per question while the page stays open
let draftKey = null;
let sending = false;
let lastSentAt = 0;
const COOLDOWN_MS = 20000; // a courtesy against accidental repeats, not real spam protection

function updateCounter() {
  const left = responseBox.maxLength - responseBox.value.length;
  counterEl.textContent = left + (left === 1 ? " character left" : " characters left");
  counterEl.classList.toggle("low", left <= 50);
  leaveBtn.disabled = sending || responseBox.value.trim() === "";
}

// Called by showPrompt() whenever a new question appears.
function onQuestionChange() {
  if (draftKey !== null) drafts[draftKey] = responseBox.value;
  draftKey = currentPrompt;
  responseBox.value = drafts[draftKey] || "";
  statusEl.textContent = "";
  respond.hidden = false;
  updateCounter();
}

responseBox.addEventListener("input", () => {
  statusEl.textContent = "";
  updateCounter();
});

leaveBtn.addEventListener("click", async () => {
  const thought = responseBox.value.trim();
  const question = currentPrompt;
  if (!thought || !question || sending) return;

  if (!db) {
    statusEl.textContent = "Sharing isn't available right now. Your words are still in the box.";
    return;
  }
  if (Date.now() - lastSentAt < COOLDOWN_MS) {
    statusEl.textContent = "Please give it a moment before leaving another.";
    return;
  }

  sending = true;
  responseBox.readOnly = true;
  leaveBtn.textContent = "Leaving\u2026";
  statusEl.textContent = "Leaving your words here\u2026";
  updateCounter();

  try {
    // Only the thought and its question are sent. "approved" is deliberately not
    // included: new rows stay unapproved until you approve them in Supabase.
    const { error } = await db.from(TABLE_NAME).insert({ thought, question });
    if (error) throw error;

    lastSentAt = Date.now();
    delete drafts[question];
    if (draftKey === question) responseBox.value = "";
    statusEl.textContent =
      "Thank you. Your words have been left here. They will appear below once they have been read and approved.";
  } catch (err) {
    console.error("Could not leave thought:", err);
    statusEl.textContent =
      "Something went wrong, and your words were not left. They are still in the box, so you can try again.";
  } finally {
    sending = false;
    responseBox.readOnly = false;
    leaveBtn.textContent = "Leave it here";
    updateCounter();
  }
});
updateCounter();

// ---- Things people left behind ----
const ENTRY_LIMIT = 20; // how many approved entries to show, newest first
const entriesEl = document.getElementById("entries");
const entriesStatus = document.getElementById("entries-status");

function setEntriesStatus(text, withRetry) {
  entriesStatus.textContent = text;
  if (text && withRetry) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "report";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadEntries);
    entriesStatus.append(" ", retry);
  }
  entriesStatus.hidden = !text;
}

// Visitors' words are always inserted with textContent, never as HTML.
function renderEntry(row) {
  const li = document.createElement("li");
  li.className = "entry";
  const q = document.createElement("p");
  q.className = "entry-question";
  q.textContent = String(row.question ?? "");
  const t = document.createElement("p");
  t.className = "entry-text";
  t.textContent = String(row.thought ?? "");
  const foot = document.createElement("div");
  foot.className = "entry-foot";
  const report = document.createElement("button");
  report.type = "button";
  report.className = "report";
  report.textContent = "Report";
  foot.append(report);
  li.append(q, t, foot);
  entriesEl.appendChild(li);
}

async function loadEntries() {
  entriesEl.replaceChildren();
  setEntriesStatus("Gathering what people have left\u2026");
  if (!db) {
    setEntriesStatus("The shared space can't be reached right now.");
    return;
  }
  try {
    const { data, error } = await db
      .from(TABLE_NAME)
      .select("id, thought, question")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(ENTRY_LIMIT);
    if (error) throw error;
    if (!data || data.length === 0) {
      setEntriesStatus("Nothing has been left here yet. You could be the first.");
      return;
    }
    setEntriesStatus("");
    data.forEach(renderEntry);
  } catch (err) {
    console.error("Could not load entries:", err);
    setEntriesStatus("What people have left couldn't be loaded just now.", true);
  }
}

// Reporting is not connected yet; the control only says so.
entriesEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".report");
  if (!btn || btn.dataset.busy) return;
  btn.dataset.busy = "1";
  btn.textContent = "Reporting isn't live yet";
  setTimeout(() => {
    btn.textContent = "Report";
    delete btn.dataset.busy;
  }, 2500);
});

loadEntries();
