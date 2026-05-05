const CATEGORY_COLORS = {
  log: "#6f6a61",
  thought: "#5f7f65",
  idea: "#b8791f",
  todo: "#24747a",
  reflection: "#8a5f76"
};

const CATEGORY_ICONS = {
  log: "icon-log",
  thought: "icon-thought",
  idea: "icon-idea",
  todo: "icon-todo",
  reflection: "icon-reflection"
};

const state = {
  category: "thought",
  captures: []
};

const timeline = document.querySelector("#timeline");
const form = document.querySelector("#capture-form");
const textarea = document.querySelector("#capture-text");
const helperLine = document.querySelector("#helper-line");
const vaultName = document.querySelector("#vault-name");
const currentMonth = document.querySelector("#current-month");
const sendButton = document.querySelector(".send-button");
const chips = Array.from(document.querySelectorAll(".chip"));

init();

async function init() {
  wireInteractions();
  await loadConfig();
  await loadCaptures();
  textarea.focus();
}

function wireInteractions() {
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.category = chip.dataset.category;
      chips.forEach((item) => item.classList.toggle("is-active", item === chip));
      textarea.focus();
    });
  });

  textarea.addEventListener("input", () => {
    autoResize(textarea);
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    await submitCapture(text);
  });
}

async function loadConfig() {
  try {
    const config = await getJson("/api/config/public");
    vaultName.textContent = config.vaultName;
    currentMonth.textContent = config.currentMonth;
    helperLine.textContent = `Append to ${relativeMonthlyPath(config.monthlyFile)}`;
  } catch (error) {
    helperLine.textContent = error.message;
  }
}

async function loadCaptures() {
  try {
    const data = await getJson("/api/captures/recent");
    state.captures = data.captures || [];
    renderTimeline();
  } catch (error) {
    renderError(error.message);
  }
}

async function submitCapture(text) {
  sendButton.disabled = true;

  try {
    const result = await postJson("/api/captures", {
      category: state.category,
      text
    });

    textarea.value = "";
    autoResize(textarea);
    await loadCaptures();
    flashHelper(`Appended to ${relativeMonthlyPath(result.monthlyFile)}`);
    textarea.focus();
  } catch (error) {
    flashHelper(error.message);
  } finally {
    sendButton.disabled = false;
  }
}

function renderTimeline() {
  timeline.innerHTML = "";

  if (!state.captures.length) {
    timeline.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Nothing in this month yet.</p>
        <p>Start with the smallest useful fragment.</p>
      </div>
    `;
    return;
  }

  for (const capture of [...state.captures].reverse()) {
    const bubble = document.createElement("article");
    bubble.className = "capture-bubble";
    bubble.style.setProperty("--category-color", CATEGORY_COLORS[capture.category] || CATEGORY_COLORS.thought);

    const text = capture.category === "todo" && capture.content
      ? capture.content
      : capture.text;

    bubble.innerHTML = `
      <div class="capture-meta">
        <span class="category-label">
          <svg aria-hidden="true"><use href="#${CATEGORY_ICONS[capture.category] || CATEGORY_ICONS.thought}"></use></svg>
          ${escapeHtml(capture.category)}
        </span>
        <span>${escapeHtml(formatCaptureLabel(capture.label))}</span>
      </div>
      <p class="capture-text">${escapeHtml(text)}</p>
    `;

    timeline.appendChild(bubble);
  }

  requestAnimationFrame(() => {
    timeline.scrollTop = timeline.scrollHeight;
  });
}

function renderError(message) {
  timeline.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">Could not load captures.</p>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function autoResize(element) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
}

function flashHelper(message) {
  const previous = helperLine.textContent;
  helperLine.textContent = message;
  window.clearTimeout(flashHelper.timer);
  flashHelper.timer = window.setTimeout(() => {
    helperLine.textContent = previous;
  }, 1800);
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function relativeMonthlyPath(filePath) {
  const marker = "2.Areas/Personal/fleeting/";
  const normalized = filePath.replaceAll("\\", "/");
  const index = normalized.indexOf(marker);
  return index === -1 ? normalized : normalized.slice(index);
}

function formatCaptureLabel(label) {
  const currentYearMatch = label.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)$/i);
  if (currentYearMatch) {
    return `${Number(currentYearMatch[2])}/${Number(currentYearMatch[3])} ${currentYearMatch[4]}`;
  }

  return label;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
