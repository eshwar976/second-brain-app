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

const TASK_COMPLETE_EXIT_MS = 700;
const THEME_STORAGE_KEY = "secondBrain.theme";
const THEME_CHOICES = new Set(["system", "light", "dark"]);
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const state = {
  category: "thought",
  captures: [],
  indexStatus: null,
  tasks: [],
  tasksTotal: 0,
  taskScope: "all",
  taskFocus: "all",
  dashboard: null,
  searchResults: [],
  pendingTodoText: "",
  pendingTriageTask: null,
  pendingEdit: null,
  todoSheetMode: "capture",
  todoImportant: true,
  todoUrgent: false,
  themePreference: "system"
};

const timeline = document.querySelector("#timeline");
const form = document.querySelector("#capture-form");
const textarea = document.querySelector("#capture-text");
const helperLine = document.querySelector("#helper-line");
const vaultName = document.querySelector("#vault-name");
const currentMonth = document.querySelector("#current-month");
const sendButton = document.querySelector(".send-button");
const chips = Array.from(document.querySelectorAll(".chip"));
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const indexStatus = document.querySelector("#index-status");
const indexRunButton = document.querySelector("#index-run-button");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
const tasksList = document.querySelector("#tasks-list");
const tasksCount = document.querySelector("#tasks-count");
const tasksRefreshButton = document.querySelector("#tasks-refresh-button");
const taskFilterButtons = Array.from(document.querySelectorAll("[data-task-filter]"));
const dashboardOverview = document.querySelector("#dashboard-overview");
const dashboardCaptures = document.querySelector("#dashboard-captures");
const dashboardFocusTasks = document.querySelector("#dashboard-focus-tasks");
const dashboardDueSoon = document.querySelector("#dashboard-due-soon");
const dashboardTriage = document.querySelector("#dashboard-triage");
const dashboardRecentNotes = document.querySelector("#dashboard-recent-notes");
const todoSheet = document.querySelector("#todo-sheet");
const todoSheetKicker = todoSheet?.querySelector(".sheet-header .eyebrow");
const todoSheetTitle = document.querySelector("#todo-sheet-title");
const todoImportantButtons = Array.from(document.querySelectorAll("[data-todo-important]"));
const todoUrgentButtons = Array.from(document.querySelectorAll("[data-todo-urgent]"));
const todoDueInput = document.querySelector("#todo-due");
const todoConfirmButton = document.querySelector("#todo-confirm");
const todoCancelButtons = Array.from(document.querySelectorAll("[data-todo-cancel]"));
const themeButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));
const themeStatus = document.querySelector("#theme-status");
const editSheet = document.querySelector("#edit-sheet");
const editSheetKicker = document.querySelector("#edit-sheet-kicker");
const editSheetTitle = document.querySelector("#edit-sheet-title");
const editText = document.querySelector("#edit-text");
const editConfirmButton = document.querySelector("#edit-confirm");
const editCancelButtons = Array.from(document.querySelectorAll("[data-edit-cancel]"));

init();

async function init() {
  initTheme();
  wireInteractions();
  await loadConfig();
  await Promise.all([loadCaptures(), loadIndexStatus()]);
  textarea.focus();
}

function wireInteractions() {
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActiveTab(item.dataset.tab);
    });
  });

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

  editText?.addEventListener("input", () => {
    autoResize(editText);
  });

  textarea.addEventListener("keydown", (event) => {
    if (shouldSubmitCaptureFromKeyboard(event)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    if (state.category === "todo") {
      openTodoSheet({ mode: "capture", text });
      return;
    }
    await submitCapture(text);
  });

  todoImportantButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.todoImportant = button.dataset.todoImportant === "true";
      renderTodoSheetState();
    });
  });

  todoUrgentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.todoUrgent = button.dataset.todoUrgent === "true";
      renderTodoSheetState();
    });
  });

  todoCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeTodoSheet());
  });

  editCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeEditSheet());
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setThemePreference(button.dataset.themeChoice);
    });
  });

  todoConfirmButton?.addEventListener("click", async () => {
    const metadata = {
      important: state.todoImportant,
      urgent: state.todoUrgent,
      due: todoDueInput?.value || ""
    };

    if (state.todoSheetMode === "triage") {
      await submitTaskTriage(metadata);
    } else {
      await submitCapture(state.pendingTodoText, metadata);
    }
  });

  editConfirmButton?.addEventListener("click", async () => {
    await submitEdit();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editSheet && !editSheet.hidden) {
      closeEditSheet();
      return;
    }
    if (event.key === "Escape" && todoSheet && !todoSheet.hidden) {
      closeTodoSheet();
    }
  });

  indexRunButton?.addEventListener("click", async () => {
    await rebuildIndex();
  });

  tasksRefreshButton?.addEventListener("click", async () => {
    await loadTasks();
  });

  tasksList?.addEventListener("click", handleTaskActionClick);
  tasksList?.addEventListener("dblclick", handleTaskEditDoubleClick);
  timeline?.addEventListener("dblclick", handleCaptureEditDoubleClick);
  [dashboardFocusTasks, dashboardDueSoon, dashboardTriage].forEach((target) => {
    target?.addEventListener("click", handleTaskActionClick);
    target?.addEventListener("dblclick", handleTaskEditDoubleClick);
  });

  taskFilterButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      state.taskScope = button.dataset.scope || "all";
      state.taskFocus = button.dataset.focus || "all";
      renderTaskFilterState();
      await loadTasks();
    });
  });

  dashboardOverview?.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-dashboard-task-focus]");
    if (!tile) return;
    openTaskView({
      scope: tile.dataset.dashboardTaskScope || "all",
      focus: tile.dataset.dashboardTaskFocus || "all"
    });
  });

  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runSearch();
  });
}

function initTheme() {
  state.themePreference = getStoredThemePreference();
  applyThemePreference(state.themePreference);

  const handleSystemThemeChange = () => {
    if (state.themePreference === "system") {
      applyThemePreference("system", { persist: false });
    }
  };

  if (systemThemeQuery.addEventListener) {
    systemThemeQuery.addEventListener("change", handleSystemThemeChange);
  } else if (systemThemeQuery.addListener) {
    systemThemeQuery.addListener(handleSystemThemeChange);
  }
}

function getStoredThemePreference() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_CHOICES.has(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function setThemePreference(preference) {
  applyThemePreference(preference);
}

function applyThemePreference(preference, { persist = true } = {}) {
  const normalized = THEME_CHOICES.has(preference) ? preference : "system";
  const resolved = normalized === "system" ? getSystemTheme() : normalized;
  state.themePreference = normalized;
  document.documentElement.dataset.themePreference = normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore private browsing/storage failures; the selected theme still applies for this page.
    }
  }

  renderThemeControls();
}

function getSystemTheme() {
  return systemThemeQuery.matches ? "dark" : "light";
}

function renderThemeControls() {
  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeChoice === state.themePreference;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (themeStatus) {
    const resolved = document.documentElement.dataset.theme || getSystemTheme();
    themeStatus.textContent = state.themePreference === "system"
      ? `System · ${capitalize(resolved)}`
      : capitalize(state.themePreference);
  }
}

function setActiveTab(tab) {
  navItems.forEach((item) => {
    const isActive = item.dataset.tab === tab;
    item.classList.toggle("is-active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === tab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
    if (isActive) {
      panel.querySelector(".workspace-view")?.scrollTo({ top: 0, left: 0 });
    }
  });

  if (tab === "capture") {
    textarea.focus();
  }

  if (tab === "dashboard") {
    loadDashboard();
    if (!state.searchResults.length) runSearch();
  }

  if (tab === "tasks") {
    loadTasks();
  }
}

function openTaskView({ scope = "all", focus = "all" } = {}) {
  state.taskScope = scope;
  state.taskFocus = focus;
  setActiveTab("tasks");
  renderTaskFilterState();
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
    state.captures = (data.captures || []).map((capture, index) => ({
      ...capture,
      clientId: `${capture.id}-${index}`
    }));
    renderTimeline();
  } catch (error) {
    renderError(error.message);
  }
}

async function loadIndexStatus() {
  try {
    state.indexStatus = await getJson("/api/index/status");
    renderIndexStatus();
  } catch (error) {
    renderIndexError(error.message);
  }
}

async function loadTasks() {
  if (tasksList) {
    tasksList.innerHTML = `<div class="empty-state"><p class="empty-title">Loading tasks...</p></div>`;
  }

  try {
    const params = new URLSearchParams({
      status: "open",
      scope: state.taskScope,
      focus: state.taskFocus
    });
    const data = await getJson(`/api/tasks?${params.toString()}`);
    state.tasks = data.tasks || [];
    state.tasksTotal = Number(data.totalCount || state.tasks.length);
    renderTasks();
  } catch (error) {
    renderTasksError(error.message);
  }
}

async function loadDashboard() {
  renderDashboardLoading();
  try {
    state.dashboard = await getJson("/api/dashboard");
    state.indexStatus = state.dashboard.index;
    renderIndexStatus();
    renderDashboard();
  } catch (error) {
    renderDashboardError(error.message);
  }
}

async function rebuildIndex() {
  indexRunButton.disabled = true;
  indexRunButton.textContent = "Indexing...";
  renderIndexMessage("Scanning vault Markdown and rebuilding the local cache.");

  try {
    const result = await postJson("/api/index/run", {});
    state.indexStatus = {
      ready: true,
      noteCount: result.noteCount,
      taskCount: result.taskCount,
      openTaskCount: result.openTaskCount,
      skippedCount: result.skippedCount,
      durationMs: result.durationMs,
      lastRunAt: result.ranAt,
      dbPath: result.dbPath
    };
    renderIndexStatus();
    await Promise.all([loadTasks(), runSearch(), loadDashboard()]);
  } catch (error) {
    renderIndexError(error.message);
  } finally {
    indexRunButton.disabled = false;
    indexRunButton.textContent = "Rebuild index";
  }
}

async function runSearch() {
  const query = searchInput?.value.trim() || "";
  if (searchResults) {
    searchResults.innerHTML = `<div class="empty-state"><p class="empty-title">Searching...</p></div>`;
  }

  try {
    const data = await getJson(`/api/notes/search?q=${encodeURIComponent(query)}`);
    state.searchResults = data.results || [];
    renderSearchResults(query);
  } catch (error) {
    renderSearchError(error.message);
  }
}

function openTodoSheet({ mode = "capture", text = "", task = null } = {}) {
  if (!todoSheet) return;
  state.todoSheetMode = mode;
  state.pendingTodoText = text;
  state.pendingTriageTask = task;
  state.todoImportant = task?.important ?? true;
  state.todoUrgent = task?.urgent ?? false;
  if (todoDueInput) todoDueInput.value = task?.due || "";
  if (todoSheetKicker) todoSheetKicker.textContent = mode === "triage" ? "task triage" : "todo capture";
  if (todoSheetTitle) todoSheetTitle.textContent = mode === "triage" ? "Triage this task" : "Clarify the task";
  if (todoConfirmButton) todoConfirmButton.textContent = mode === "triage" ? "Save triage" : "Save todo";
  renderTodoSheetState();
  todoSheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => todoConfirmButton?.focus());
}

function closeTodoSheet() {
  if (!todoSheet) return;
  todoSheet.hidden = true;
  document.body.classList.remove("sheet-open");
  state.pendingTodoText = "";
  state.pendingTriageTask = null;
  state.todoSheetMode = "capture";
  if (todoSheetKicker) todoSheetKicker.textContent = "todo capture";
  if (todoSheetTitle) todoSheetTitle.textContent = "Clarify the task";
  if (todoConfirmButton) todoConfirmButton.textContent = "Save todo";
  if (document.querySelector('[data-tab-panel="capture"].is-active')) textarea.focus();
}

function renderTodoSheetState() {
  todoImportantButtons.forEach((button) => {
    const isActive = (button.dataset.todoImportant === "true") === state.todoImportant;
    button.classList.toggle("is-active", isActive);
  });

  todoUrgentButtons.forEach((button) => {
    const isActive = (button.dataset.todoUrgent === "true") === state.todoUrgent;
    button.classList.toggle("is-active", isActive);
  });
}

async function submitCapture(text, metadata = {}) {
  sendButton.disabled = true;
  if (todoConfirmButton) todoConfirmButton.disabled = true;

  try {
    const result = await postJson("/api/captures", {
      category: state.category,
      text,
      ...metadata
    });

    textarea.value = "";
    autoResize(textarea);
    if (todoSheet && !todoSheet.hidden) closeTodoSheet();
    await loadCaptures();
    flashHelper(`Appended to ${relativeMonthlyPath(result.monthlyFile)}`);
    textarea.focus();
  } catch (error) {
    flashHelper(error.message);
  } finally {
    sendButton.disabled = false;
    if (todoConfirmButton) todoConfirmButton.disabled = false;
  }
}

async function submitTaskTriage(metadata = {}) {
  if (!state.pendingTriageTask) return;
  if (todoConfirmButton) todoConfirmButton.disabled = true;

  try {
    await postJson("/api/tasks/triage", {
      taskId: state.pendingTriageTask.id,
      ...metadata
    });
    closeTodoSheet();
    await refreshTaskSurfaces();
  } catch (error) {
    flashHelper(error.message);
  } finally {
    if (todoConfirmButton) todoConfirmButton.disabled = false;
  }
}

async function handleTaskActionClick(event) {
  const toggleButton = event.target.closest("[data-task-toggle]");
  if (toggleButton) {
    event.preventDefault();
    event.stopPropagation();
    await toggleTaskDone(toggleButton.dataset.taskToggle);
    return;
  }

  const triageButton = event.target.closest("[data-task-triage]");
  if (triageButton) {
    event.preventDefault();
    event.stopPropagation();
    const task = findTaskById(triageButton.dataset.taskTriage);
    if (task) openTodoSheet({ mode: "triage", task });
  }
}

function handleCaptureEditDoubleClick(event) {
  const card = event.target.closest("[data-capture-id]");
  if (!card || event.target.closest("button")) return;
  const capture = state.captures.find((item) => item.clientId === card.dataset.captureId);
  if (capture) openEditSheet({ kind: "capture", item: capture });
}

function handleTaskEditDoubleClick(event) {
  const row = event.target.closest("[data-task-id]");
  if (!row || event.target.closest("button")) return;
  const task = findTaskById(row.dataset.taskId);
  if (task) openEditSheet({ kind: "task", item: task });
}

function openEditSheet({ kind, item }) {
  if (!editSheet || !editText) return;
  state.pendingEdit = { kind, item };
  editText.value = item.text || "";
  autoResize(editText);
  if (editSheetKicker) editSheetKicker.textContent = kind === "task" ? "task" : item.category || "capture";
  if (editSheetTitle) editSheetTitle.textContent = kind === "task" ? "Edit task" : "Edit capture";
  editSheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => {
    editText.focus();
    editText.select();
  });
}

function closeEditSheet() {
  if (!editSheet) return;
  editSheet.hidden = true;
  document.body.classList.remove("sheet-open");
  state.pendingEdit = null;
  if (editText) editText.value = "";
  if (document.querySelector('[data-tab-panel="capture"].is-active')) textarea.focus();
}

async function submitEdit() {
  if (!state.pendingEdit || !editText) return;
  const text = editText.value.trim();
  if (!text) {
    flashHelper("Edited text is required.");
    return;
  }

  if (editConfirmButton) editConfirmButton.disabled = true;

  try {
    const { kind, item } = state.pendingEdit;
    if (kind === "capture") {
      await postJson("/api/captures/update", {
        content: item.content,
        text
      });
      closeEditSheet();
      await loadCaptures();
      const activeTab = document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel;
      if (activeTab === "dashboard") await loadDashboard();
    } else {
      await postJson("/api/tasks/update", {
        taskId: item.id,
        text
      });
      closeEditSheet();
      await refreshTaskSurfaces();
    }
  } catch (error) {
    flashHelper(error.message);
  } finally {
    if (editConfirmButton) editConfirmButton.disabled = false;
  }
}

async function toggleTaskDone(taskId) {
  if (!taskId) return;
  const buttons = Array.from(document.querySelectorAll(`[data-task-toggle="${cssEscape(taskId)}"]`));
  const rows = getTaskRowsForButtons(buttons);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-label", "Task completed");
  });
  markTaskRowsCompleting(rows, true);

  try {
    await postJson("/api/tasks/toggle", { taskId, status: "done" });
    await delay(TASK_COMPLETE_EXIT_MS);
    await refreshTaskSurfaces();
  } catch (error) {
    markTaskRowsCompleting(rows, false);
    flashHelper(error.message);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-label", "Mark task done");
    });
  }
}

function getTaskRowsForButtons(buttons) {
  return buttons
    .map((button) => button.closest(".task-row, .mini-row"))
    .filter(Boolean);
}

function markTaskRowsCompleting(rows, isCompleting) {
  rows.forEach((row) => {
    row.classList.toggle("is-completing", isCompleting);
  });
}

async function refreshTaskSurfaces() {
  await loadIndexStatus();
  const activeTab = document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel;
  if (activeTab === "tasks") await loadTasks();
  if (activeTab === "dashboard") await loadDashboard();
}

function findTaskById(taskId) {
  const lists = [
    state.tasks,
    state.dashboard?.highFocusTasks || [],
    state.dashboard?.dueSoonTasks || [],
    state.dashboard?.triageTasks || []
  ];
  return lists.flat().find((task) => task.id === taskId) || null;
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
    bubble.dataset.captureId = capture.clientId;
    bubble.title = "Double-click to edit";
    bubble.style.setProperty("--category-color", CATEGORY_COLORS[capture.category] || CATEGORY_COLORS.thought);

    bubble.innerHTML = `
      <div class="capture-meta">
        <span class="category-label">
          <svg aria-hidden="true"><use href="#${CATEGORY_ICONS[capture.category] || CATEGORY_ICONS.thought}"></use></svg>
          ${escapeHtml(capture.category)}
        </span>
        <span>${escapeHtml(formatCaptureLabel(capture.label))}</span>
      </div>
      <p class="capture-text">${escapeHtml(capture.text)}</p>
    `;

    timeline.appendChild(bubble);
  }

  requestAnimationFrame(() => {
    timeline.scrollTop = timeline.scrollHeight;
  });
}

function renderIndexStatus() {
  if (!indexStatus || !state.indexStatus) return;

  const status = state.indexStatus;
  const lastRun = status.lastRunAt ? formatDateTime(status.lastRunAt) : "Not indexed yet";
  const watcher = formatWatcherStatus(status.watcher);
  indexStatus.innerHTML = `
    <div class="metric">
      <span class="metric-value">${numberFormat(status.noteCount)}</span>
      <span class="metric-label">Notes</span>
    </div>
    <div class="metric">
      <span class="metric-value">${numberFormat(status.openTaskCount)}</span>
      <span class="metric-label">Open tasks</span>
    </div>
    <div class="metric">
      <span class="metric-value">${numberFormat(status.skippedCount)}</span>
      <span class="metric-label">Skipped paths</span>
    </div>
    <p class="index-meta">Last indexed: ${escapeHtml(lastRun)}</p>
    <p class="index-meta">Watcher: ${escapeHtml(watcher)}</p>
  `;
}

function renderDashboard() {
  if (!state.dashboard) return;
  renderDashboardOverview(state.dashboard);
  renderDashboardCaptures(state.dashboard.recentCaptures || []);
  renderDashboardTaskList(dashboardFocusTasks, state.dashboard.highFocusTasks || [], "No high-focus tasks in the current index.");
  renderDashboardTaskList(dashboardDueSoon, state.dashboard.dueSoonTasks || [], "No due-soon tasks in the current index.");
  renderDashboardTaskList(dashboardTriage, state.dashboard.triageTasks || [], "No tasks need triage.");
  renderDashboardRecentNotes(state.dashboard.recentNotes || []);
}

function renderDashboardOverview(data) {
  if (!dashboardOverview) return;
  const summary = data.taskSummary || {};
  dashboardOverview.innerHTML = `
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="do-now" aria-label="Show do now tasks">
      <span class="overview-value">${numberFormat(summary.doNowCount)}</span>
      <span class="overview-label">Do now</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="schedule" aria-label="Show scheduled tasks">
      <span class="overview-value">${numberFormat(summary.scheduleCount)}</span>
      <span class="overview-label">Schedule</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="quick" aria-label="Show quick tasks">
      <span class="overview-value">${numberFormat(summary.quickCount)}</span>
      <span class="overview-label">Quick</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="someday" aria-label="Show someday tasks">
      <span class="overview-value">${numberFormat(summary.somedayCount)}</span>
      <span class="overview-label">Someday</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="due-soon" aria-label="Show due soon tasks">
      <span class="overview-value">${numberFormat(summary.dueSoonCount)}</span>
      <span class="overview-label">Due soon</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="high" aria-label="Show high focus tasks">
      <span class="overview-value">${numberFormat(summary.highCount)}</span>
      <span class="overview-label">High focus</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="triage" aria-label="Show tasks needing triage">
      <span class="overview-value">${numberFormat(summary.triageCount)}</span>
      <span class="overview-label">Needs triage</span>
    </button>
    <button class="overview-tile overview-link" type="button" data-dashboard-task-scope="all" data-dashboard-task-focus="all" aria-label="Show all open tasks">
      <span class="overview-value">${numberFormat(summary.openCount)}</span>
      <span class="overview-label">Open tasks</span>
    </button>
  `;
}

function renderDashboardCaptures(captures) {
  if (!dashboardCaptures) return;
  if (!captures.length) {
    dashboardCaptures.innerHTML = `<p class="quiet-line">No recent captures yet.</p>`;
    return;
  }
  dashboardCaptures.innerHTML = captures.map((capture) => `
    <article class="mini-row">
      <span class="mini-type mini-${escapeHtml(capture.category)}">${escapeHtml(capture.category)}</span>
      <p>${escapeHtml(capture.text)}</p>
      ${capture.category === "todo" ? renderTaskBadges(capture.metadata || {}) : ""}
    </article>
  `).join("");
}

function renderDashboardTaskList(target, tasks, emptyMessage) {
  if (!target) return;
  if (!tasks.length) {
    target.innerHTML = `<p class="quiet-line">${escapeHtml(emptyMessage)}</p>`;
    return;
  }
  target.innerHTML = tasks.map((task) => `
    <article class="mini-row" data-task-id="${escapeHtml(task.id)}" title="Double-click to edit">
      ${renderTaskCheckbox(task)}
      <p>${escapeHtml(task.text)}</p>
      ${renderTaskBadges(task)}
      <small>${escapeHtml(task.path)}:${task.lineNumber}</small>
    </article>
  `).join("");
}

function renderDashboardRecentNotes(notes) {
  if (!dashboardRecentNotes) return;
  if (!notes.length) {
    dashboardRecentNotes.innerHTML = `<p class="quiet-line">No recent notes found.</p>`;
    return;
  }
  dashboardRecentNotes.innerHTML = notes.map((note) => `
    <article class="mini-row">
      <p><strong>${escapeHtml(note.title)}</strong></p>
      <small>${escapeHtml(note.path)}</small>
    </article>
  `).join("");
}

function renderDashboardLoading() {
  [dashboardOverview, dashboardCaptures, dashboardFocusTasks, dashboardDueSoon, dashboardTriage, dashboardRecentNotes].forEach((target) => {
    if (target) target.innerHTML = `<p class="quiet-line">Loading...</p>`;
  });
}

function renderDashboardError(message) {
  if (dashboardOverview) {
    dashboardOverview.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Dashboard unavailable.</p>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
}

function renderIndexMessage(message) {
  if (!indexStatus) return;
  indexStatus.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">${escapeHtml(message)}</p>
    </div>
  `;
}

function renderIndexError(message) {
  if (!indexStatus) return;
  indexStatus.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">Index unavailable.</p>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderSearchResults(query) {
  if (!searchResults) return;

  if (!state.searchResults.length) {
    searchResults.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">${query ? "No matches found." : "No indexed notes yet."}</p>
        <p>${query ? "Try a different word or rebuild the index." : "Rebuild the index to populate recent notes."}</p>
      </div>
    `;
    return;
  }

  searchResults.innerHTML = state.searchResults.map((note) => `
    <article class="result-row">
      <div>
        <h2>${escapeHtml(note.title)}</h2>
        <p>${escapeHtml(note.snippet)}</p>
      </div>
      <div class="result-meta">
        <span>${escapeHtml(note.para || "note")}</span>
        <span>${escapeHtml(note.path)}</span>
      </div>
    </article>
  `).join("");
}

function renderSearchError(message) {
  if (!searchResults) return;
  searchResults.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">Search unavailable.</p>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderTasks() {
  if (!tasksList || !tasksCount) return;
  tasksCount.textContent = `${state.tasksTotal} open`;
  renderTaskFilterState();

  if (!state.tasks.length) {
    tasksList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">No open tasks found.</p>
        <p>Rebuild the index after adding Markdown tasks.</p>
      </div>
    `;
    return;
  }

  tasksList.innerHTML = state.tasks.map((task) => `
    <article class="task-row" data-task-id="${escapeHtml(task.id)}" title="Double-click to edit">
      ${renderTaskCheckbox(task)}
      <div class="task-main">
        <p>${escapeHtml(task.text)}</p>
        <div class="task-meta">
          ${renderTaskBadges(task)}
          ${task.project ? `<span>${escapeHtml(task.project)}</span>` : ""}
          <span>${escapeHtml(task.path)}:${task.lineNumber}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderTaskCheckbox(task) {
  return `
    <button
      class="task-checkbox"
      type="button"
      data-task-toggle="${escapeHtml(task.id)}"
      aria-label="Mark task done"
      title="Mark done"
    ></button>
  `;
}

function renderTaskBadges(task) {
  const badges = [];
  const taskId = task.id || null;
  const makeEditable = (badge) => taskId ? {
    ...badge,
    className: `${badge.className} task-badge-button`,
    taskId
  } : badge;

  if (shouldShowQuadrantBadge(task)) {
    badges.push(makeEditable({ label: formatQuadrant(task.quadrant), className: `task-badge-${task.quadrant}` }));
  }
  if (task.important === true) badges.push(makeEditable({ label: "important", className: "task-badge-important" }));
  if (task.urgent === true) badges.push(makeEditable({ label: "urgent", className: "task-badge-urgent" }));
  if (task.priority) badges.push(makeEditable({ label: task.priority, className: `priority-${String(task.priority).toLowerCase()}` }));
  if (task.due) badges.push(makeEditable({ label: `due ${task.due}`, className: "task-badge-due" }));
  if (task.hasTodoMetadata === false || task.quadrant === "triage") {
    badges.push({
      label: "needs triage",
      className: "task-badge-triage task-badge-button",
      taskId
    });
  }

  if (!badges.length) return "";

  return `
    <div class="task-badges">
      ${badges.map((badge) => `
        ${badge.taskId ? `
          <button class="task-badge ${escapeHtml(badge.className)}" type="button" data-task-triage="${escapeHtml(badge.taskId)}" aria-label="Edit task metadata">${escapeHtml(badge.label)}</button>
        ` : `
          <span class="task-badge ${escapeHtml(badge.className)}">${escapeHtml(badge.label)}</span>
        `}
      `).join("")}
    </div>
  `;
}

function shouldShowQuadrantBadge(task) {
  if (!task.quadrant) return false;
  if (task.quadrant === "schedule" && task.due) return false;
  return true;
}

function formatQuadrant(value) {
  return {
    "do-now": "do now",
    schedule: "schedule",
    quick: "quick",
    someday: "someday",
    triage: "triage"
  }[value] || value;
}

function renderTaskFilterState() {
  taskFilterButtons.forEach((button) => {
    const isActive = (button.dataset.scope || "all") === state.taskScope
      && (button.dataset.focus || "all") === state.taskFocus;
    button.classList.toggle("is-active", isActive);
  });
}

function renderTasksError(message) {
  if (!tasksList) return;
  tasksList.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">Could not load tasks.</p>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
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

function shouldSubmitCaptureFromKeyboard(event) {
  if (event.key !== "Enter" || event.isComposing) return false;
  if (event.shiftKey) return false;
  if (event.metaKey || event.ctrlKey) return true;
  return window.matchMedia("(pointer: fine) and (min-width: 760px)").matches;
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

function numberFormat(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function formatWatcherStatus(watcher) {
  if (!watcher) return "unavailable";
  if (watcher.status === "watching" && watcher.pending) return "watching, indexing soon";
  if (watcher.status === "watching" && watcher.queued) return "watching, queued";
  if (watcher.status === "watching") return "watching";
  if (watcher.status === "error") return `error: ${watcher.lastError || "unknown"}`;
  return watcher.status || "unavailable";
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
