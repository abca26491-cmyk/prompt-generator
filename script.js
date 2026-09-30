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
