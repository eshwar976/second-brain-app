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

const CAPTURE_TYPE_OPTIONS = ["log", "thought", "idea", "reflection"];
const TASK_COMPLETE_EXIT_MS = 500;
const TASK_UNDO_TOAST_MS = 5200;
const THEME_STORAGE_KEY = "secondBrain.theme";
const APP_SECRET_STORAGE_KEY = "secondBrain.appSecret";
const CHAT_THINKING_STORAGE_KEY = "secondBrain.chatThinkingMode";
const CHAT_SESSION_STORAGE_KEY = "secondBrain.activeChatSession";
const CHAT_SUGGEST_DEBOUNCE_MS = 90;
const CHAT_RESPONSE_POLL_MS = 3000;
const THEME_CHOICES = new Set(["system", "light", "dark"]);
const CHAT_THINKING_CHOICES = new Set(["disabled", "enabled"]);
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const state = {
  category: "thought",
  captures: [],
  indexStatus: null,
  tasks: [],
  tasksTotal: 0,
  taskStatus: "open",
  taskScope: "all",
  taskSource: "all",
  taskFocus: "all",
  captureView: "today",
  chatMessages: [],
  chatSending: false,
  chatThinkingMode: "disabled",
  chatSession: null,
  chatSessions: [],
  chatSessionPickerOpen: false,
  chatResponsePollTimer: null,
  captureSwipe: null,
  chatSuggestions: {
    open: false,
    trigger: "",
    kind: "",
    query: "",
    start: 0,
    end: 0,
    items: [],
    activeIndex: 0,
    requestId: 0
  },
  dashboard: null,
  config: null,
  searchResults: [],
  pendingTodoText: "",
  pendingChatCaptureSource: "",
  pendingTriageTask: null,
  pendingEdit: null,
  todoSheetMode: "capture",
  todoImportant: true,
  todoUrgent: false,
  captureSaving: false,
  authSecret: "",
  themePreference: "system",
  toastTimer: null
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
const chatTimeline = document.querySelector("#chat-timeline");
const chatForm = document.querySelector("#chat-form");
const chatText = document.querySelector("#chat-text");
const chatSendButton = document.querySelector("#chat-send-button");
const chatHelperLine = document.querySelector("#chat-helper-line");
const chatStatus = document.querySelector("#chat-status");
const chatThinkingButtons = Array.from(document.querySelectorAll("[data-chat-thinking]"));
const chatSuggestions = document.querySelector("#chat-suggestions");
const chatNewSessionButton = document.querySelector("#chat-new-session");
const chatSessionHistoryButton = document.querySelector("#chat-session-history");
const chatSessionPopover = document.querySelector("#chat-session-popover");
const tasksList = document.querySelector("#tasks-list");
const tasksCount = document.querySelector("#tasks-count");
const tasksRefreshButton = document.querySelector("#tasks-refresh-button");
const taskStatusFilter = document.querySelector("#task-status-filter");
const taskFocusFilter = document.querySelector("#task-focus-filter");
const taskScopeFilter = document.querySelector("#task-scope-filter");
const taskSourceFilter = document.querySelector("#task-source-filter");
const taskFilterClearButton = document.querySelector("#task-filter-clear");
const captureViewButtons = Array.from(document.querySelectorAll("[data-capture-view]"));
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
const duePresetButtons = Array.from(document.querySelectorAll("[data-due-preset]"));
const todoDueInput = document.querySelector("#todo-due");
const todoConfirmButton = document.querySelector("#todo-confirm");
const todoCancelButtons = Array.from(document.querySelectorAll("[data-todo-cancel]"));
const themeButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));
const themeStatus = document.querySelector("#theme-status");
const settingsDetails = document.querySelector("#settings-details");
const authWarning = document.querySelector("#auth-warning");
const authSheet = document.querySelector("#auth-sheet");
const authInput = document.querySelector("#auth-secret");
const authConfirmButton = document.querySelector("#auth-confirm");
const authCancelButtons = Array.from(document.querySelectorAll("[data-auth-cancel]"));
const editSheet = document.querySelector("#edit-sheet");
const editSheetKicker = document.querySelector("#edit-sheet-kicker");
const editSheetTitle = document.querySelector("#edit-sheet-title");
const editText = document.querySelector("#edit-text");
const editConfirmButton = document.querySelector("#edit-confirm");
const editCancelButtons = Array.from(document.querySelectorAll("[data-edit-cancel]"));
const actionToast = document.querySelector("#action-toast");

init();

async function init() {
  initTheme();
  initAuth();
  wireInteractions();
  registerServiceWorker();
  await loadConfig();
  await loadStoredChatSession();
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

  chatText?.addEventListener("input", () => {
    autoResize(chatText);
    updateChatSuggestions();
  });

  chatText?.addEventListener("click", updateChatSuggestions);
  chatText?.addEventListener("blur", () => {
    window.setTimeout(closeChatSuggestions, 120);
  });

  chatThinkingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const requestedMode = button.dataset.chatThinking === "enabled" ? "enabled" : "disabled";
      state.chatThinkingMode = state.chatThinkingMode === requestedMode ? "disabled" : requestedMode;
      localStorage.setItem(CHAT_THINKING_STORAGE_KEY, state.chatThinkingMode);
      renderChatThinkingState();
      chatText?.focus();
    });
  });

  chatNewSessionButton?.addEventListener("click", async () => {
    await startNewChatSession();
  });

  chatSessionHistoryButton?.addEventListener("click", async () => {
    await toggleChatSessionPicker();
  });

  chatSessionPopover?.addEventListener("mousedown", handleChatSessionPickerPointer);

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

  chatText?.addEventListener("keydown", (event) => {
    if (handleChatSuggestionKeydown(event)) return;
    if (shouldSubmitCaptureFromKeyboard(event)) {
      event.preventDefault();
      chatForm?.requestSubmit();
    }
  });

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitChat();
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

  duePresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDuePreset(button.dataset.duePreset || "none");
    });
  });

  todoDueInput?.addEventListener("change", renderTodoSheetState);

  todoCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeTodoSheet());
  });

  editCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeEditSheet());
  });

  authCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeAuthSheet());
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

  authConfirmButton?.addEventListener("click", () => {
    saveAuthSecret();
  });

  authInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveAuthSecret();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editSheet && !editSheet.hidden) {
      closeEditSheet();
      return;
    }
    if (event.key === "Escape" && authSheet && !authSheet.hidden) {
      closeAuthSheet();
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

  actionToast?.addEventListener("click", async (event) => {
    const undoButton = event.target.closest("[data-undo-task]");
    if (!undoButton) return;
    event.preventDefault();
    await toggleTaskStatus(undoButton.dataset.undoTask, "open", { showUndo: false });
    hideToast();
  });

  tasksList?.addEventListener("click", handleTaskActionClick);
  chatTimeline?.addEventListener("click", handleChatSourceClick);
  chatSuggestions?.addEventListener("mousedown", handleChatSuggestionPointer);
  tasksList?.addEventListener("dblclick", handleTaskEditDoubleClick);
  timeline?.addEventListener("change", handleCaptureCategoryChange);
  timeline?.addEventListener("pointerdown", handleCapturePointerDown);
  timeline?.addEventListener("pointermove", handleCapturePointerMove);
  timeline?.addEventListener("pointerup", handleCapturePointerUp);
  timeline?.addEventListener("pointercancel", resetCaptureSwipe);
  timeline?.addEventListener("dblclick", handleCaptureEditDoubleClick);
  [dashboardFocusTasks, dashboardDueSoon, dashboardTriage].forEach((target) => {
    target?.addEventListener("click", handleTaskActionClick);
    target?.addEventListener("dblclick", handleTaskEditDoubleClick);
  });

  [taskStatusFilter, taskFocusFilter, taskScopeFilter, taskSourceFilter].forEach((select) => {
    select?.addEventListener("change", async () => {
      readTaskFiltersFromControls();
      renderTaskFilterState();
      await loadTasks();
    });
  });

  taskFilterClearButton?.addEventListener("click", async () => {
    resetTaskFilters();
    renderTaskFilterState();
    await loadTasks();
  });

  captureViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.captureView = button.dataset.captureView || "today";
      renderCaptureViewState();
      renderTimeline();
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // PWA install support is a convenience; the app should stay quiet if registration is blocked.
  });
}

function initAuth() {
  try {
    state.authSecret = window.localStorage.getItem(APP_SECRET_STORAGE_KEY) || "";
  } catch {
    state.authSecret = "";
  }
}

function saveAuthSecret() {
  const secret = authInput?.value.trim() || "";
  state.authSecret = secret;
  try {
    if (secret) {
      window.localStorage.setItem(APP_SECRET_STORAGE_KEY, secret);
    } else {
      window.localStorage.removeItem(APP_SECRET_STORAGE_KEY);
    }
  } catch {
    // Secret still applies for this page even if storage is blocked.
  }
  closeAuthSheet();
  flashHelper(secret ? "Passcode saved locally." : "Passcode cleared.");
}

function openAuthSheet() {
  if (!authSheet || !authInput) return;
  authInput.value = state.authSecret || "";
  authSheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => {
    authInput.focus();
    authInput.select();
  });
}

function closeAuthSheet() {
  if (!authSheet) return;
  authSheet.hidden = true;
  document.body.classList.remove("sheet-open");
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

  if (tab === "chat") {
    renderChat();
    chatText?.focus();
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
  state.taskStatus = "open";
  state.taskSource = "all";
  setActiveTab("tasks");
  renderTaskFilterState();
}

async function loadConfig() {
  try {
    const config = await getJson("/api/config/public");
    state.config = config;
    const storedThinkingMode = localStorage.getItem(CHAT_THINKING_STORAGE_KEY);
    state.chatThinkingMode = CHAT_THINKING_CHOICES.has(storedThinkingMode)
      ? storedThinkingMode
      : (config.chat?.defaultThinking || "disabled");
    vaultName.textContent = config.vaultName;
    currentMonth.textContent = config.currentMonth;
    if (chatStatus) chatStatus.textContent = config.chat?.enabled ? getActiveChatModel() : "API key needed";
    helperLine.textContent = "";
    renderChatThinkingState();
    renderSettingsDetails(config);
  } catch (error) {
    helperLine.textContent = error.message;
  }
}

function renderChatThinkingState() {
  chatThinkingButtons.forEach((button) => {
    const active = state.chatThinkingMode === "enabled";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (chatStatus && state.config?.chat?.enabled) {
    chatStatus.textContent = getActiveChatModel();
  }
}

function getThinkingLabel() {
  return state.chatThinkingMode === "enabled" ? "thinking" : "regular";
}

function getActiveChatModel() {
  if (!state.config?.chat) return "";
  const model = state.chatThinkingMode === "enabled"
    ? (state.config.chat.thinkingModel || state.config.chat.model || "")
    : (state.config.chat.regularModel || state.config.chat.model || "");
  return formatDisplayModel(model);
}

function formatDisplayModel(model) {
  return String(model || "").split("/").pop() || "";
}

function getActiveChatSessionPath() {
  if (state.chatSession?.path) return state.chatSession.path;
  try {
    return window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

async function loadStoredChatSession() {
  let stored = "";
  try {
    stored = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY) || "";
  } catch {
    stored = "";
  }
  if (!stored) return;

  try {
    const params = new URLSearchParams({ path: stored });
    const data = await protectedGetJson(`/api/chat/session?${params.toString()}`);
    state.chatSession = data.session || null;
    state.chatMessages = (data.messages || []).filter((message) => message.content);
    renderChat();
    renderChatSessionState();
    flashChatHelper(state.chatSession?.title ? `Loaded ${state.chatSession.title}.` : "Loaded session.");
  } catch (error) {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    state.chatSession = null;
    state.chatMessages = [];
    renderChatSessionState();
    flashChatHelper(error.message);
  }
}

async function startNewChatSession() {
  closeChatSessionPicker();
  state.chatSession = null;
  state.chatMessages = [];
  try {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory session is still reset.
  }
  renderChat();
  renderChatSessionState();
  flashChatHelper("New session ready.");
  chatText?.focus();
}

async function toggleChatSessionPicker() {
  if (state.chatSessionPickerOpen) {
    closeChatSessionPicker();
    return;
  }
  state.chatSessionPickerOpen = true;
  renderChatSessionPicker({ loading: true });
  try {
    const data = await protectedGetJson("/api/chat/sessions?limit=30");
    state.chatSessions = data.sessions || [];
    renderChatSessionPicker();
  } catch (error) {
    renderChatSessionPicker({ error: error.message });
  }
}

function closeChatSessionPicker() {
  state.chatSessionPickerOpen = false;
  if (chatSessionPopover) {
    chatSessionPopover.hidden = true;
    chatSessionPopover.innerHTML = "";
  }
  chatSessionHistoryButton?.setAttribute("aria-expanded", "false");
}

function renderChatSessionPicker({ loading = false, error = "" } = {}) {
  if (!chatSessionPopover) return;
  chatSessionPopover.hidden = false;
  chatSessionHistoryButton?.setAttribute("aria-expanded", "true");
  const sessions = state.chatSessions || [];
  chatSessionPopover.innerHTML = `
    <div class="session-popover-head">
      <strong>Chat sessions</strong>
      <span>${escapeHtml(state.config?.chat?.sessionsDir || "")}</span>
    </div>
    ${loading ? `<p class="session-empty">Loading sessions...</p>` : ""}
    ${error ? `<p class="session-empty">${escapeHtml(error)}</p>` : ""}
    ${!loading && !error && sessions.length ? `
      <div class="session-list">
        ${sessions.map(renderChatSessionOption).join("")}
      </div>
    ` : ""}
    ${!loading && !error && !sessions.length ? `<p class="session-empty">No saved sessions yet.</p>` : ""}
  `;
}

function renderChatSessionOption(session) {
  const active = state.chatSession?.path === session.path;
  return `
    <button class="session-option ${active ? "is-active" : ""}" type="button" data-session-path="${escapeHtml(session.path)}">
      <strong>${escapeHtml(session.title || "Untitled session")}</strong>
      <small>${escapeHtml(formatSessionUpdated(session.updated || session.created))}</small>
    </button>
  `;
}

async function handleChatSessionPickerPointer(event) {
  const button = event.target.closest("[data-session-path]");
  if (!button) return;
  event.preventDefault();
  await openChatSession(button.dataset.sessionPath || "");
}

async function openChatSession(sessionPath) {
  if (!sessionPath) return;
  try {
    const params = new URLSearchParams({ path: sessionPath });
    const data = await protectedGetJson(`/api/chat/session?${params.toString()}`);
    state.chatSession = data.session || null;
    state.chatMessages = (data.messages || []).filter((message) => message.content);
    if (state.chatSession?.path) {
      window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, state.chatSession.path);
    }
    closeChatSessionPicker();
    renderChat();
    renderChatSessionState();
    flashChatHelper(state.chatSession?.title ? `Opened ${state.chatSession.title}.` : "Opened session.");
    chatText?.focus();
  } catch (error) {
    renderChatSessionPicker({ error: error.message });
  }
}

function renderChatSessionState() {
  if (!chatSessionHistoryButton) return;
  chatSessionHistoryButton.textContent = state.chatSession?.title ? clipUiText(state.chatSession.title, 18) : "Sessions";
  chatSessionHistoryButton.title = state.chatSession?.path || "Sessions";
}

function formatSessionUpdated(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function clipUiText(value, length) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function updateChatSuggestions() {
  if (!chatText || !chatSuggestions) return;
  const match = getActiveReferenceToken(chatText.value, chatText.selectionStart || 0);
  if (!match) {
    closeChatSuggestions();
    return;
  }

  state.chatSuggestions = {
    ...state.chatSuggestions,
    open: true,
    trigger: match.trigger,
    kind: match.kind,
    query: match.query,
    start: match.start,
    end: match.end,
    activeIndex: 0
  };
  renderChatSuggestions();
  window.clearTimeout(updateChatSuggestions.timer);
  updateChatSuggestions.timer = window.setTimeout(loadChatSuggestions, CHAT_SUGGEST_DEBOUNCE_MS);
}

function getActiveReferenceToken(value, caret) {
  const before = String(value || "").slice(0, caret);
  const match = before.match(/(?:^|\s)([#/@])([A-Za-z0-9_-]*)$/);
  if (!match) return null;
  const trigger = match[1];
  const query = match[2] || "";
  const tokenStart = before.length - trigger.length - query.length;
  return {
    trigger,
    kind: getReferenceKindForTrigger(trigger),
    query,
    start: tokenStart,
    end: caret
  };
}

function getReferenceKindForTrigger(trigger) {
  if (trigger === "#") return "file";
  if (trigger === "/") return "skill";
  if (trigger === "@") return "people";
  return "";
}

async function loadChatSuggestions() {
  if (!state.chatSuggestions.open || !state.chatSuggestions.kind) return;
  const requestId = state.chatSuggestions.requestId + 1;
  state.chatSuggestions.requestId = requestId;
  renderChatSuggestions({ loading: true });
  try {
    const params = new URLSearchParams({
      kind: state.chatSuggestions.kind,
      q: state.chatSuggestions.query
    });
    const data = await protectedGetJson(`/api/chat/references?${params.toString()}`);
    if (requestId !== state.chatSuggestions.requestId) return;
    state.chatSuggestions.items = data.suggestions || [];
    state.chatSuggestions.activeIndex = 0;
    renderChatSuggestions();
  } catch (error) {
    if (requestId !== state.chatSuggestions.requestId) return;
    state.chatSuggestions.items = [];
    renderChatSuggestions({ error: error.message });
  }
}

function renderChatSuggestions({ loading = false, error = "" } = {}) {
  if (!chatSuggestions || !state.chatSuggestions.open) return;
  const label = getReferenceLabel(state.chatSuggestions.kind);
  const items = state.chatSuggestions.items || [];
  chatSuggestions.hidden = false;
  positionChatSuggestions();
  chatSuggestions.innerHTML = `
    <div class="suggestion-head">
      <span>${escapeHtml(state.chatSuggestions.trigger)}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
    ${loading ? `<p class="suggestion-empty">Searching...</p>` : ""}
    ${error ? `<p class="suggestion-empty">${escapeHtml(error)}</p>` : ""}
    ${!loading && !error && items.length ? `
      <div class="suggestion-list" role="listbox">
        ${items.map((item, index) => renderChatSuggestionItem(item, index)).join("")}
      </div>
    ` : ""}
    ${!loading && !error && !items.length ? `<p class="suggestion-empty">No ${escapeHtml(label.toLowerCase())} found.</p>` : ""}
  `;
}

function renderChatSuggestionItem(item, index) {
  const active = index === state.chatSuggestions.activeIndex;
  return `
    <button class="suggestion-item ${active ? "is-active" : ""}" type="button" data-suggestion-index="${index}" role="option" aria-selected="${active}">
      <span class="suggestion-token">${escapeHtml(state.chatSuggestions.trigger)}${escapeHtml(item.token || item.name || item.title)}</span>
      <strong>${escapeHtml(item.title || item.name || item.token)}</strong>
      <small>${escapeHtml(getReferenceKindSingular(item.kind || state.chatSuggestions.kind))}</small>
    </button>
  `;
}

function getReferenceLabel(kind) {
  if (kind === "mentor") return "Mentors";
  if (kind === "assistant") return "Assistants";
  if (kind === "skill") return "Skills";
  if (kind === "people") return "People";
  if (kind === "file") return "Files";
  return "References";
}

function getReferenceKindSingular(kind) {
  if (kind === "mentor") return "mentor";
  if (kind === "assistant") return "assistant";
  if (kind === "skill") return "skill";
  if (kind === "people") return "person";
  if (kind === "file") return "file";
  return "reference";
}

function positionChatSuggestions() {
  if (!chatSuggestions || !chatText || !chatForm) return;
  const formRect = chatForm.getBoundingClientRect();
  const textRect = chatText.getBoundingClientRect();
  const cursorRatio = estimateCursorRatio(chatText.value, state.chatSuggestions.start);
  const popupWidth = Math.min(340, Math.max(260, textRect.width * 0.72));
  const rawLeft = textRect.left - formRect.left + (textRect.width - popupWidth) * cursorRatio;
  const maxLeft = Math.max(8, formRect.width - popupWidth - 8);
  const left = Math.max(8, Math.min(rawLeft, maxLeft));
  const bottom = Math.max(64, formRect.bottom - textRect.top + 8);
  chatSuggestions.style.setProperty("--suggest-left", `${Math.round(left)}px`);
  chatSuggestions.style.setProperty("--suggest-bottom", `${Math.round(bottom)}px`);
  chatSuggestions.style.setProperty("--suggest-width", `${Math.round(popupWidth)}px`);
}

function estimateCursorRatio(value, index) {
  const line = String(value || "").slice(0, index).split(/\n/).pop() || "";
  return Math.max(0, Math.min(line.length / 42, 1));
}

function handleChatSuggestionKeydown(event) {
  if (!state.chatSuggestions.open) return false;
  const items = state.chatSuggestions.items || [];
  if (event.key === "Escape") {
    event.preventDefault();
    closeChatSuggestions();
    return true;
  }
  if (!items.length) return false;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.chatSuggestions.activeIndex = (state.chatSuggestions.activeIndex + 1) % items.length;
    renderChatSuggestions();
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.chatSuggestions.activeIndex = (state.chatSuggestions.activeIndex - 1 + items.length) % items.length;
    renderChatSuggestions();
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    insertChatSuggestion(items[state.chatSuggestions.activeIndex]);
    return true;
  }
  return false;
}

function handleChatSuggestionPointer(event) {
  const button = event.target.closest("[data-suggestion-index]");
  if (!button) return;
  event.preventDefault();
  const item = state.chatSuggestions.items[Number(button.dataset.suggestionIndex)];
  if (item) insertChatSuggestion(item);
}

function insertChatSuggestion(item) {
  if (!chatText || !item) return;
  const token = `${state.chatSuggestions.trigger}${item.token || item.name || item.title}`;
  const before = chatText.value.slice(0, state.chatSuggestions.start);
  const after = chatText.value.slice(state.chatSuggestions.end);
  const suffix = after.startsWith(" ") ? "" : " ";
  chatText.value = `${before}${token}${suffix}${after}`;
  const caret = before.length + token.length + suffix.length;
  chatText.setSelectionRange(caret, caret);
  autoResize(chatText);
  closeChatSuggestions();
  chatText.focus();
}

function closeChatSuggestions() {
  window.clearTimeout(updateChatSuggestions.timer);
  state.chatSuggestions.open = false;
  state.chatSuggestions.items = [];
  if (chatSuggestions) {
    chatSuggestions.hidden = true;
    chatSuggestions.innerHTML = "";
  }
}

function renderSettingsDetails(config) {
  if (authWarning) {
    authWarning.hidden = !config.securityWarning;
    authWarning.textContent = config.securityWarning || "";
    authWarning.classList.toggle("is-danger", config.lanAccess && !config.authRequired);
  }

  if (!settingsDetails) return;
  const ignoreCount = Array.isArray(config.ignoreRules) ? config.ignoreRules.length : 0;
  const ignoreList = Array.isArray(config.ignoreRules) && config.ignoreRules.length
    ? `
      <details class="settings-ignore">
        <summary>Ignored paths <span>${numberFormat(ignoreCount)}</span></summary>
        <ul>
          ${config.ignoreRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
        </ul>
      </details>
    `
    : "";
  const backupItems = config.backups ? [
    ["Vault Git", config.backups.vault],
    ["App Git", config.backups.app]
  ] : [];
  const backupWarning = backupItems.find(([, item]) => item?.dirty);
  const backupGrid = backupItems.length ? `
    <div class="settings-grid backup-grid">
      ${backupItems.map(([label, item]) => `
        <div class="${item?.dirty ? "is-warning" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(item?.summary || "unknown")}</strong>
        </div>
      `).join("")}
    </div>
  ` : "";
  settingsDetails.innerHTML = `
    <div class="settings-grid">
      <div><span>Vault</span><strong>${escapeHtml(config.vaultName)}</strong></div>
      <div><span>Target file</span><strong>${escapeHtml(relativeMonthlyPath(config.targetFile || config.monthlyFile))}</strong></div>
      <div><span>Host</span><strong>${escapeHtml(config.host)}:${escapeHtml(config.port)}</strong></div>
      <div><span>Local URL</span><strong>${escapeHtml(config.localUrl)}</strong></div>
      <div><span>LAN URL</span><strong>${escapeHtml(config.lanUrl || "disabled")}</strong></div>
      <div><span>Write auth</span><strong>${config.authRequired ? "enabled" : "not set"}</strong></div>
      <div><span>Ignored paths</span><strong>${numberFormat(ignoreCount)}</strong></div>
    </div>
    ${backupWarning ? `<p class="warning-line">Backup reminder: ${escapeHtml(backupWarning[0])} has ${escapeHtml(backupWarning[1].summary)}.</p>` : ""}
    ${backupGrid}
    ${ignoreList}
    <div class="settings-actions">
      ${config.authRequired ? `
        <button class="secondary-button" type="button" data-auth-open>Set/reset app passcode</button>
        <button class="secondary-button" type="button" data-auth-clear>Clear saved passcode</button>
      ` : ""}
    </div>
  `;
  settingsDetails.querySelector("[data-auth-open]")?.addEventListener("click", openAuthSheet);
  settingsDetails.querySelector("[data-auth-clear]")?.addEventListener("click", () => {
    state.authSecret = "";
    try {
      window.localStorage.removeItem(APP_SECRET_STORAGE_KEY);
    } catch {
      // Nothing else to clear.
    }
    flashHelper("Saved passcode cleared from this browser.");
  });
}

async function loadCaptures() {
  try {
    const data = await getJson("/api/captures/recent?limit=200");
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
      status: state.taskStatus,
      scope: state.taskScope,
      source: state.taskSource,
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

async function submitChat() {
  const message = chatText?.value.trim() || "";
  if (!message || state.chatSending) return;
  const activeSessionPath = getActiveChatSessionPath();
  const baselineAssistantCount = state.chatMessages.filter((item) => item.role === "assistant" && !item.isError && !item.isPending).length;

  const userMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: message,
    sources: []
  };
  state.chatMessages.push(userMessage);
  state.chatSending = true;
  if (chatSendButton) chatSendButton.disabled = true;
  if (chatText) {
    chatText.value = "";
    autoResize(chatText);
  }
  flashChatHelper("Thinking...");
  renderChat();
  const payloadHistory = state.chatMessages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(0, -1)
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));

  let stopResponsePolling = () => {};
  let assistantMessage = null;
  try {
    const session = await ensureChatSessionForSubmit(message, activeSessionPath);
    state.chatSession = session || state.chatSession;
    if (state.chatSession?.path) {
      window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, state.chatSession.path);
    }
    renderChatSessionState();

    assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "Waiting for OpenCode...",
      sources: [],
      mentor: null,
      assistant: null,
      people: [],
      isPending: true,
      sessionPath: state.chatSession?.path || activeSessionPath
    };
    state.chatMessages.push(assistantMessage);
    renderChat();
    if (state.chatSession?.path) {
      stopResponsePolling = startChatResponsePolling(state.chatSession.path, assistantMessage.id, baselineAssistantCount);
    }

    const data = await postJson("/api/chat", {
      message,
      history: payloadHistory,
      thinkingMode: state.chatThinkingMode,
      sessionPath: state.chatSession?.path || activeSessionPath
    });
    stopResponsePolling();
    state.chatSession = data.session || state.chatSession;
    if (state.chatSession?.path) {
      window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, state.chatSession.path);
    }
    renderChatSessionState();
    updateChatMessage(assistantMessage.id, {
      content: data.answer || "",
      sources: data.sources || [],
      mentor: data.mentor || null,
      assistant: data.assistant || null,
      people: data.people || [],
      model: data.model || "",
      thinkingMode: data.thinkingMode || state.chatThinkingMode,
      sessionPath: state.chatSession?.path || activeSessionPath,
      isPending: false
    });
    flashChatHelper(data.sources?.length
      ? `Saved session · used ${data.sources.length} source${data.sources.length === 1 ? "" : "s"}.`
      : "Saved session.");
  } catch (error) {
    stopResponsePolling();
    if (assistantMessage) {
      updateChatMessage(assistantMessage.id, {
        content: error.message,
        sources: [],
        isError: true,
        isPending: false
      });
    } else {
      state.chatMessages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: error.message,
        sources: [],
        isError: true
      });
    }
    flashChatHelper(error.message);
  } finally {
    stopResponsePolling();
    state.chatSending = false;
    if (chatSendButton) chatSendButton.disabled = false;
    renderChat();
    chatText?.focus();
  }
}

async function ensureChatSessionForSubmit(message, activeSessionPath) {
  if (activeSessionPath) {
    if (state.chatSession?.path === activeSessionPath) return state.chatSession;
    const params = new URLSearchParams({ path: activeSessionPath });
    const data = await protectedGetJson(`/api/chat/session?${params.toString()}`);
    return data.session || null;
  }
  const data = await postJson("/api/chat/session", {
    title: deriveClientChatTitle(message)
  });
  return data || null;
}

function deriveClientChatTitle(message) {
  return clipUiText(String(message || "").replace(/\s+/g, " ").trim(), 48) || "New chat";
}

function startChatResponsePolling(sessionPath, assistantMessageId, baselineAssistantCount) {
  stopChatResponsePolling();
  let stopped = false;

  const poll = async () => {
    if (stopped || !sessionPath) return;
    try {
      const params = new URLSearchParams({ path: sessionPath });
      const data = await protectedGetJson(`/api/chat/session?${params.toString()}`);
      const assistantMessages = (data.messages || []).filter((item) => item.role === "assistant" && item.content);
      if (assistantMessages.length <= baselineAssistantCount) return;
      const partial = assistantMessages[baselineAssistantCount] || assistantMessages.at(-1);
      if (!partial?.content) return;
      const changed = updateChatMessage(assistantMessageId, {
        content: partial.content,
        sources: partial.sources || [],
        mentor: partial.mentor || null,
        assistant: partial.assistant || null,
        people: partial.people || [],
        isPending: true
      });
      if (changed) flashChatHelper("Receiving...");
    } catch {
      // The final /api/chat response still owns error handling.
    }
  };

  state.chatResponsePollTimer = window.setInterval(poll, CHAT_RESPONSE_POLL_MS);
  window.setTimeout(poll, CHAT_RESPONSE_POLL_MS);

  return () => {
    stopped = true;
    stopChatResponsePolling();
  };
}

function stopChatResponsePolling() {
  if (!state.chatResponsePollTimer) return;
  window.clearInterval(state.chatResponsePollTimer);
  state.chatResponsePollTimer = null;
}

function updateChatMessage(messageId, patch) {
  const message = state.chatMessages.find((item) => item.id === messageId);
  if (!message) return false;
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (message[key] !== value) {
      message[key] = value;
      changed = true;
    }
  }
  if (changed) renderChat();
  return changed;
}

function handleChatSourceClick(event) {
  const button = event.target.closest("[data-open-note]");
  if (!button) return;
  event.preventDefault();
  const path = button.dataset.openNote || "";
  if (path) window.location.href = getObsidianNoteUrl(path);
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

function setDuePreset(preset) {
  if (!todoDueInput) return;
  if (preset === "today") {
    todoDueInput.value = getLocalDateSlug();
  } else if (preset === "tomorrow") {
    todoDueInput.value = getLocalDateSlug(addDays(new Date(), 1));
  }
  renderTodoSheetState();
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

  duePresetButtons.forEach((button) => {
    button.classList.toggle("is-active", getDuePresetForValue(todoDueInput?.value || "") === button.dataset.duePreset);
  });
}

async function submitCapture(text, metadata = {}) {
  if (state.captureSaving) return;
  state.captureSaving = true;
  sendButton.disabled = true;
  if (todoConfirmButton) todoConfirmButton.disabled = true;
  helperLine.textContent = "Saving...";

  try {
    const result = await postJson("/api/captures", {
      category: state.category,
      text,
      source: metadata.source || state.pendingChatCaptureSource || "",
      ...metadata
    });

    textarea.value = "";
    autoResize(textarea);
    if (todoSheet && !todoSheet.hidden) closeTodoSheet();
    await loadCaptures();
    flashHelper(`Saved to ${relativeMonthlyPath(result.monthlyFile)}`);
    textarea.focus();
  } catch (error) {
    flashHelper(error.message);
  } finally {
    state.pendingChatCaptureSource = "";
    state.captureSaving = false;
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
  const openButton = event.target.closest("[data-open-obsidian]");
  if (openButton) {
    event.preventDefault();
    event.stopPropagation();
    const task = findTaskById(openButton.dataset.openObsidian);
    if (task) window.location.href = getObsidianTaskUrl(task);
    return;
  }

  const toggleButton = event.target.closest("[data-task-toggle]");
  if (toggleButton) {
    event.preventDefault();
    event.stopPropagation();
    await toggleTaskStatus(toggleButton.dataset.taskToggle, toggleButton.dataset.taskStatus || "done");
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
  if (!card || event.target.closest("button, select")) return;
  const capture = state.captures.find((item) => item.clientId === card.dataset.captureId);
  if (capture) openEditSheet({ kind: "capture", item: capture });
}

async function handleCaptureCategoryChange(event) {
  const select = event.target.closest("[data-capture-category-select]");
  if (!select) return;
  const capture = state.captures.find((item) => item.clientId === select.dataset.captureCategorySelect);
  const category = select.value;
  if (!capture || category === capture.category) return;

  select.disabled = true;
  try {
    await postJson("/api/captures/update", {
      content: capture.content,
      text: capture.displayText || capture.text,
      category
    });
    await loadCaptures();
    const activeTab = document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel;
    if (activeTab === "dashboard") await loadDashboard();
    flashHelper(`Changed to ${category}.`);
  } catch (error) {
    select.value = capture.category;
    flashHelper(error.message);
  } finally {
    select.disabled = false;
  }
}

function handleCapturePointerDown(event) {
  const card = event.target.closest("[data-capture-id]");
  if (!card || event.target.closest("button, select, textarea, input, a")) return;
  state.captureSwipe = {
    id: card.dataset.captureId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: true
  };
  card.classList.add("is-swipe-ready");
}

function handleCapturePointerMove(event) {
  const swipe = state.captureSwipe;
  if (!swipe?.active || swipe.pointerId !== event.pointerId) return;
  const card = timeline?.querySelector(`[data-capture-id="${cssEscape(swipe.id)}"]`);
  if (!card) return;
  const dx = Math.max(0, event.clientX - swipe.startX);
  const dy = Math.abs(event.clientY - swipe.startY);
  if (dy > 42) {
    resetCaptureSwipe();
    return;
  }
  card.style.setProperty("--swipe-offset", `${Math.min(dx, 92)}px`);
  card.classList.toggle("is-swiping", dx > 12);
}

function handleCapturePointerUp(event) {
  const swipe = state.captureSwipe;
  if (!swipe?.active || swipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipe.startX;
  const dy = Math.abs(event.clientY - swipe.startY);
  const capture = state.captures.find((item) => item.clientId === swipe.id);
  resetCaptureSwipe();
  if (capture && dx > 86 && dy < 44) {
    openChatForCapture(capture);
  }
}

function resetCaptureSwipe() {
  if (!state.captureSwipe?.id) {
    state.captureSwipe = null;
    return;
  }
  const card = timeline?.querySelector(`[data-capture-id="${cssEscape(state.captureSwipe.id)}"]`);
  if (card) {
    card.classList.remove("is-swipe-ready", "is-swiping");
    card.style.removeProperty("--swipe-offset");
  }
  state.captureSwipe = null;
}

function openChatForCapture(capture) {
  const category = capture.category || "capture";
  const text = capture.displayText || capture.text || "";
  setActiveTab("chat");
  if (chatText) {
    chatText.value = `Let's think through this ${category} capture:\n\n${text}`;
    autoResize(chatText);
    chatText.focus();
  }
  flashChatHelper("Capture loaded into chat.");
}

function handleTaskEditDoubleClick(event) {
  const row = event.target.closest("[data-task-id]");
  if (!row || event.target.closest("button, a")) return;
  const task = findTaskById(row.dataset.taskId);
  if (task) openEditSheet({ kind: "task", item: task });
}

function openEditSheet({ kind, item }) {
  if (!editSheet || !editText) return;
  state.pendingEdit = { kind, item };
  editText.value = kind === "capture" ? (item.displayText || item.text || "") : (item.text || "");
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
        text,
        category: item.category
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

async function toggleTaskStatus(taskId, nextStatus = "done", { showUndo = true } = {}) {
  if (!taskId) return;
  const buttons = Array.from(document.querySelectorAll(`[data-task-toggle="${cssEscape(taskId)}"]`));
  const rows = getTaskRowsForButtons(buttons);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-label", nextStatus === "done" ? "Task completed" : "Task reopened");
  });
  markTaskRowsCompleting(rows, nextStatus === "done");

  try {
    await postJson("/api/tasks/toggle", { taskId, status: nextStatus });
    if (nextStatus === "done") await delay(TASK_COMPLETE_EXIT_MS);
    await refreshTaskSurfaces();
    if (nextStatus === "done" && showUndo) {
      showUndoToast(taskId);
    } else {
      flashHelper(nextStatus === "done" ? "Marked done." : "Reopened task.");
    }
  } catch (error) {
    markTaskRowsCompleting(rows, false);
    flashHelper(error.message);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-label", nextStatus === "done" ? "Mark task done" : "Mark task open");
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

function getObsidianTaskUrl(task) {
  return getObsidianNoteUrl(task.path || "");
}

function getObsidianNoteUrl(notePath) {
  const vault = state.config?.vaultName || "";
  const file = String(notePath || "").replace(/\.md$/i, "");
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
}

function renderChat() {
  if (!chatTimeline) return;
  if (!state.chatMessages.length) {
    chatTimeline.innerHTML = `
      <div class="empty-state chat-empty">
        <p class="empty-title">Ask the vault.</p>
        <p>Use #mentor, /assistant, or @person to add focused context.</p>
      </div>
    `;
    return;
  }

  chatTimeline.innerHTML = state.chatMessages.map((message) => `
    <article class="chat-message chat-${escapeHtml(message.role)} ${message.isError ? "is-error" : ""}">
      <div class="chat-message-body">
        <p class="chat-role">${message.role === "user" ? "You" : "Second Brain"}</p>
        <div class="chat-text">${formatMessageText(message.content)}</div>
        ${renderChatContexts(message)}
        ${message.sources?.length ? renderChatSources(message.sources) : ""}
      </div>
    </article>
  `).join("");

  requestAnimationFrame(() => {
    chatTimeline.scrollTop = chatTimeline.scrollHeight;
  });
}

function renderChatContexts(message) {
  const contexts = [
    message.mentor ? { label: message.mentor.autoSelected ? "Auto mentor" : "Mentor", item: message.mentor } : null,
    message.assistant ? { label: message.assistant.autoSelected ? "Auto assistant" : "Assistant", item: message.assistant } : null,
    ...(message.people || []).map((item) => ({ label: "Person", item }))
  ].filter(Boolean);
  if (!contexts.length) return "";
  return `
    <div class="chat-mentor">
      ${contexts.map(({ label, item }) => `
        <span>${escapeHtml(label)}</span>
        <button type="button" data-open-note="${escapeHtml(item.path)}" title="${escapeHtml(item.path)}">${escapeHtml(item.title || item.name || label.toLowerCase())}</button>
      `).join("")}
    </div>
  `;
}

function renderChatSources(sources) {
  return `
    <div class="chat-sources" aria-label="Sources">
      ${sources.map((source, index) => `
        <button class="chat-source" type="button" data-open-note="${escapeHtml(source.path)}" title="${escapeHtml(source.path)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(source.title || source.path)}</strong>
          <small>${escapeHtml(source.path)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function formatMessageText(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderTimeline() {
  timeline.innerHTML = "";
  renderCaptureViewState();

  if (!state.captures.length) {
    timeline.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Nothing in this month yet.</p>
        <p>Start with the smallest useful fragment.</p>
      </div>
    `;
    return;
  }

  const ordered = [...state.captures].reverse();
  const today = getLocalDateSlug();
  const todaysCaptures = ordered.filter((capture) => getCaptureDay(capture) === today);
  const weekStart = getStartOfWeekSlug();
  const thisWeekCaptures = ordered.filter((capture) => {
    const day = getCaptureDay(capture);
    return day && day !== today && day >= weekStart;
  });
  const olderCaptures = ordered.filter((capture) => {
    const day = getCaptureDay(capture);
    return day && day !== today && day < weekStart;
  });
  const monthCaptures = ordered.filter((capture) => getCaptureDay(capture) !== today);

  if (state.captureView === "month" && monthCaptures.length) {
    const older = document.createElement("details");
    older.className = "capture-day capture-older";
    older.innerHTML = `<summary>Older this month <span>${monthCaptures.length}</span></summary>`;
    older.open = !todaysCaptures.length;
    appendCaptureGroups(older, monthCaptures);
    timeline.appendChild(older);
  }

  if (state.captureView === "week" && thisWeekCaptures.length) {
    appendCaptureGroups(timeline, thisWeekCaptures);
  }

  if (todaysCaptures.length) {
    appendDayDivider(timeline, "Today");
    todaysCaptures.forEach((capture) => timeline.appendChild(renderCaptureBubble(capture)));
  } else if (state.captureView === "week" && !thisWeekCaptures.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <p class="empty-title">No captures this week.</p>
      <p>Switch to Month to see older entries.</p>
    `;
    timeline.appendChild(empty);
  } else if (monthCaptures.length) {
    appendDayDivider(timeline, "Today");
    const empty = document.createElement("p");
    empty.className = "quiet-line today-empty";
    empty.textContent = getEmptyTodayText();
    timeline.appendChild(empty);
  }

  requestAnimationFrame(() => {
    timeline.scrollTop = timeline.scrollHeight;
  });
}

function getEmptyTodayText() {
  if (state.captureView === "month") return "No captures yet today.";
  if (state.captureView === "week") return "No captures yet today.";
  return "No captures yet today. Switch to This week or Month to see older entries.";
}

function renderCaptureViewState() {
  captureViewButtons.forEach((button) => {
    const isActive = (button.dataset.captureView || "today") === state.captureView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function appendCaptureGroups(target, captures) {
  let currentDay = "";
  for (const capture of captures) {
    const day = getCaptureDay(capture);
    if (day !== currentDay) {
      currentDay = day;
      appendDayDivider(target, formatDayLabel(day));
    }
    target.appendChild(renderCaptureBubble(capture));
  }
}

function appendDayDivider(target, label) {
  const divider = document.createElement("div");
  divider.className = "day-divider";
  divider.textContent = label;
  target.appendChild(divider);
}

function renderCaptureBubble(capture) {
  const bubble = document.createElement("article");
  bubble.className = "capture-bubble";
  bubble.dataset.captureId = capture.clientId;
  bubble.title = "Double-click to edit";
  bubble.style.setProperty("--category-color", CATEGORY_COLORS[capture.category] || CATEGORY_COLORS.thought);

  bubble.innerHTML = `
    <div class="capture-meta">
      ${renderCaptureCategoryControl(capture)}
      <span>${escapeHtml(formatCaptureLabel(capture.label))}</span>
    </div>
    <p class="capture-text">${escapeHtml(capture.displayText || capture.text)}</p>
  `;

  return bubble;
}

function renderCaptureCategoryControl(capture) {
  const icon = CATEGORY_ICONS[capture.category] || CATEGORY_ICONS.thought;
  if (capture.category === "todo") {
    return `
      <span class="category-label">
        <svg aria-hidden="true"><use href="#${icon}"></use></svg>
        ${escapeHtml(capture.category)}
      </span>
    `;
  }
  return `
    <label class="category-label category-select-label" title="Change capture type">
      <svg aria-hidden="true"><use href="#${icon}"></use></svg>
      <select data-capture-category-select="${escapeHtml(capture.clientId)}" aria-label="Change capture type">
        ${CAPTURE_TYPE_OPTIONS.map((category) => `
          <option value="${escapeHtml(category)}" ${category === capture.category ? "selected" : ""}>${escapeHtml(category)}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function getCaptureDay(capture) {
  const heading = String(capture.heading || "").match(/\d{4}-\d{2}-\d{2}/);
  if (heading) return heading[0];
  const label = String(capture.label || "").match(/\d{4}-\d{2}-\d{2}/);
  return label ? label[0] : "";
}

function getStartOfWeekSlug() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return getLocalDateSlug(date);
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
      ${renderTaskSourceInfo(task)}
      ${renderTaskCheckbox(task)}
      <p>${escapeHtml(task.text)}</p>
      ${renderTaskBadges(task)}
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
  tasksCount.textContent = `${state.tasksTotal} ${state.taskStatus}`;
  renderTaskFilterState();

  if (!state.tasks.length) {
    tasksList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">No open tasks found.</p>
        <p>${state.taskStatus === "done" ? "Completed tasks will appear here." : "Rebuild the index after adding Markdown tasks."}</p>
      </div>
    `;
    return;
  }

  tasksList.innerHTML = state.tasks.map((task) => `
    <article class="task-row" data-task-id="${escapeHtml(task.id)}" title="Double-click to edit">
      ${renderTaskSourceInfo(task)}
      ${renderTaskCheckbox(task)}
      <div class="task-main">
        <p>${escapeHtml(task.text)}</p>
        <div class="task-meta">
          ${renderTaskBadges(task)}
          ${task.project ? `<span>${escapeHtml(task.project)}</span>` : ""}
        </div>
      </div>
    </article>
  `).join("");
}

function renderTaskSourceInfo(task) {
  if (!task?.id || !task?.path) return "";
  const label = `${task.path}:${task.lineNumber}`;
  return `
    <button
      class="task-info-button"
      type="button"
      data-open-obsidian="${escapeHtml(task.id)}"
      aria-label="Open source note in Obsidian"
      title="${escapeHtml(label)}"
    >↗</button>
  `;
}

function renderTaskCheckbox(task) {
  const nextStatus = task.status === "done" ? "open" : "done";
  const label = task.status === "done" ? "Reopen task" : "Mark task done";
  return `
    <button
      class="task-checkbox"
      type="button"
      data-task-toggle="${escapeHtml(task.id)}"
      data-task-status="${escapeHtml(nextStatus)}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
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
  if (taskStatusFilter) taskStatusFilter.value = state.taskStatus;
  if (taskFocusFilter) taskFocusFilter.value = state.taskFocus;
  if (taskScopeFilter) taskScopeFilter.value = state.taskScope;
  if (taskSourceFilter) taskSourceFilter.value = state.taskSource;
  taskFilterClearButton?.toggleAttribute("disabled", !hasActiveTaskFilters());
}

function readTaskFiltersFromControls() {
  state.taskStatus = taskStatusFilter?.value || "open";
  state.taskFocus = taskFocusFilter?.value || "all";
  state.taskScope = taskScopeFilter?.value || "all";
  state.taskSource = taskSourceFilter?.value || "all";
}

function resetTaskFilters() {
  state.taskStatus = "open";
  state.taskFocus = "all";
  state.taskScope = "all";
  state.taskSource = "all";
}

function hasActiveTaskFilters() {
  return state.taskStatus !== "open"
    || state.taskFocus !== "all"
    || state.taskScope !== "all"
    || state.taskSource !== "all";
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

function flashHelper(message, { restoreText = "" } = {}) {
  helperLine.textContent = message;
  window.clearTimeout(flashHelper.timer);
  flashHelper.timer = window.setTimeout(() => {
    helperLine.textContent = restoreText;
  }, 1800);
}

function flashChatHelper(message, { restoreText = "" } = {}) {
  if (!chatHelperLine) return;
  chatHelperLine.textContent = message;
  window.clearTimeout(flashChatHelper.timer);
  flashChatHelper.timer = window.setTimeout(() => {
    chatHelperLine.textContent = restoreText;
  }, 2200);
}

function showUndoToast(taskId) {
  if (!actionToast) {
    flashHelper("Marked done.");
    return;
  }
  window.clearTimeout(state.toastTimer);
  actionToast.hidden = false;
  actionToast.innerHTML = `
    <span>Marked done.</span>
    <button type="button" data-undo-task="${escapeHtml(taskId)}">Undo</button>
  `;
  state.toastTimer = window.setTimeout(hideToast, TASK_UNDO_TOAST_MS);
}

function hideToast() {
  if (!actionToast) return;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = null;
  actionToast.hidden = true;
  actionToast.innerHTML = "";
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function protectedGetJson(url) {
  const response = await fetch(url, {
    headers: getWriteHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) openAuthSheet();
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: getWriteHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) openAuthSheet();
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function getWriteHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.authSecret) headers["X-Second-Brain-Secret"] = state.authSecret;
  return headers;
}

function relativeMonthlyPath(filePath) {
  const marker = "2.Areas/Personal/fleeting/";
  const normalized = filePath.replaceAll("\\", "/");
  const index = normalized.indexOf(marker);
  return index === -1 ? normalized : normalized.slice(index);
}

function getLocalDateSlug(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDuePresetForValue(value) {
  if (!value) return "none";
  const today = getLocalDateSlug();
  if (value === today) return "today";
  if (value === getLocalDateSlug(addDays(new Date(), 1))) return "tomorrow";
  return "";
}

function formatDayLabel(day) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day || "Earlier";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
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
