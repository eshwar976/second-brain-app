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
const TASK_VIEW_STORAGE_KEY = "secondBrain.taskView";
const THEME_STORAGE_KEY = "secondBrain.theme";
const APP_SECRET_STORAGE_KEY = "secondBrain.appSecret";
const CHAT_THINKING_STORAGE_KEY = "secondBrain.chatThinkingMode";
const CHAT_SESSION_STORAGE_KEY = "secondBrain.activeChatSession";
const DEEP_WORK_ENABLED_STORAGE_KEY = "secondBrain.deepWork.enabled";
const DEEP_WORK_GOAL_STORAGE_KEY = "secondBrain.deepWork.goal";
const DEEP_WORK_SESSION_STORAGE_KEY = "secondBrain.deepWork.sessionPath";
const RECENT_CONTEXT_STORAGE_KEY = "secondBrain.chat.recentContext";
const PINNED_CONTEXT_STORAGE_KEY = "secondBrain.chat.pinnedContext";
const CHAT_SUGGEST_DEBOUNCE_MS = 90;
const CHAT_CONTEXT_SUGGEST_DEBOUNCE_MS = 420;
const CHAT_AUTO_RESUME_MS = 30 * 60 * 1000;
const RECENT_CONTEXT_LIMIT = 6;
const PINNED_CONTEXT_LIMIT = 8;
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
  taskView: "matrix",
  captureView: "today",
  chatMessages: [],
  chatSending: false,
  chatThinkingMode: "disabled",
  deepWorkEnabled: false,
  deepWorkGoal: "",
  deepWorkSessionPath: "",
  chatSession: null,
  chatSessions: [],
  chatSessionsLoaded: false,
  chatSessionsLoading: false,
  chatSessionsRequest: null,
  chatSessionPickerOpen: false,
  chatSessionQuery: "",
  captureSwipe: null,
  taskSwipe: null,
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
  chatContext: [],
  recentChatContext: [],
  pinnedChatContext: [],
  suggestedChatContext: {
    query: "",
    items: [],
    requestId: 0,
    hiddenForMessage: "",
    dismissedForMessage: "",
    dismissedKeys: new Set()
  },
  dashboard: null,
  dashboardShowAllCadence: false,
  personalSprint: null,
  personalSprintView: "",
  sprintOpenObjectives: new Set(),
  sprintExpandedKr: "",
  config: null,
  searchResults: [],
  pendingTodoText: "",
  pendingChatCaptureSource: "",
  chatSummarySaving: false,
  chatTodosExtracting: false,
  chatNoteCreating: false,
  pendingTriageTask: null,
  pendingEdit: null,
  todoSheetMode: "capture",
  todoImportant: true,
  todoUrgent: false,
  todoEffort: "",
  captureSaving: false,
  captureInFlightKey: "",
  lastCaptureKey: "",
  lastCaptureAt: 0,
  authSecret: "",
  authUser: null,
  themePreference: "system",
  toastTimer: null,
  speech: {
    supported: false,
    activeTarget: "",
    recognition: null,
    baseText: "",
    finalText: ""
  }
};

const timeline = document.querySelector("#timeline");
const captureScreen = document.querySelector(".capture-screen");
const form = document.querySelector("#capture-form");
const textarea = document.querySelector("#capture-text");
const helperLine = document.querySelector("#helper-line");
const captureSpeechButton = document.querySelector("#capture-speech-button");
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
const chatSpeechButton = document.querySelector("#chat-speech-button");
const chatStatus = document.querySelector("#chat-status");
const chatThinkingButtons = Array.from(document.querySelectorAll("[data-chat-thinking]"));
const chatActionsTrigger = document.querySelector("#chat-actions-trigger");
const chatActionsSheet = document.querySelector("#chat-actions-sheet");
const chatActionsCancelButtons = Array.from(document.querySelectorAll("[data-chat-actions-cancel]"));
const chatSaveSummaryButton = document.querySelector("#chat-save-summary");
const chatExtractTodosButton = document.querySelector("#chat-extract-todos");
const chatCreateNoteButton = document.querySelector("#chat-create-note");
const chatSuggestions = document.querySelector("#chat-suggestions");
const chatContextPanel = document.querySelector("#chat-context-panel");
const chatSuggestedContext = document.querySelector("#chat-suggested-context");
const chatNewSessionButton = document.querySelector("#chat-new-session");
const chatSessionHistoryButton = document.querySelector("#chat-session-history");
const chatSessionPopover = document.querySelector("#chat-session-popover");
const deepWorkToggle = document.querySelector("#deep-work-toggle");
const deepWorkSheet = document.querySelector("#deep-work-sheet");
const deepWorkGoalInput = document.querySelector("#deep-work-goal");
const deepWorkRecapInput = document.querySelector("#deep-work-recap");
const deepWorkRecapField = document.querySelector("#deep-work-recap-field");
const deepWorkCaptureReflection = document.querySelector("#deep-work-capture-reflection");
const deepWorkCaptureRow = document.querySelector("#deep-work-capture-row");
const deepWorkConfirmButton = document.querySelector("#deep-work-confirm");
const deepWorkStopButton = document.querySelector("#deep-work-stop");
const deepWorkCancelButtons = Array.from(document.querySelectorAll("[data-deep-work-cancel]"));
const contextSheet = document.querySelector("#context-sheet");
const contextDetailList = document.querySelector("#context-detail-list");
const contextCancelButtons = Array.from(document.querySelectorAll("[data-context-cancel]"));
const tasksList = document.querySelector("#tasks-list");
const tasksCount = document.querySelector("#tasks-count");
const tasksNavBadge = document.querySelector("#tasks-nav-badge");
const tasksRefreshButton = document.querySelector("#tasks-refresh-button");
const taskFilterPanel = document.querySelector("#task-filter-panel");
const taskFilterToggle = document.querySelector("#task-filter-toggle");
const taskFilterCount = document.querySelector("#task-filter-count");
const taskFocusFilter = document.querySelector("#task-focus-filter");
const taskScopeFilter = document.querySelector("#task-scope-filter");
const taskSourceFilter = document.querySelector("#task-source-filter");
const taskFilterClearButton = document.querySelector("#task-filter-clear");
const taskViewButtons = Array.from(document.querySelectorAll("[data-task-view]"));
const captureViewButtons = Array.from(document.querySelectorAll("[data-capture-view]"));
const dashboardIdentity = document.querySelector("#dashboard-identity");
const dashboardOverview = document.querySelector("#dashboard-overview");
const dashboardCadenceToggle = document.querySelector("#dashboard-cadence-toggle");
const dashboardHabits = document.querySelector("#dashboard-habits");
const dashboardDeepWork = document.querySelector("#dashboard-deep-work");
const dashboardDeepWorkRefresh = document.querySelector("#dashboard-deep-work-refresh");
const sprintContent = document.querySelector("#sprint-content");
const sprintViewToggle = document.querySelector("#sprint-view-toggle");
const sprintCategorizeButton = document.querySelector("#sprint-categorize-button");
const sprintRefreshButton = document.querySelector("#sprint-refresh-button");
const todoSheet = document.querySelector("#todo-sheet");
const todoSheetKicker = todoSheet?.querySelector(".sheet-header .eyebrow");
const todoSheetTitle = document.querySelector("#todo-sheet-title");
const todoImportantButtons = Array.from(document.querySelectorAll("[data-todo-important]"));
const todoUrgentButtons = Array.from(document.querySelectorAll("[data-todo-urgent]"));
const todoEffortButtons = Array.from(document.querySelectorAll("[data-todo-effort]"));
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
let appViewportHeight = 0;

init();

async function init() {
  initTheme();
  initAuth();
  initMobileViewport();
  initTaskView();
  initDeepWork();
  initChatContextMemory();
  wireInteractions();
  initSpeechRecognition();
  registerServiceWorker();
  await loadConfig();
  await checkAuth();
  const gated = await gateAuth();
  if (!gated) return;
  await loadStoredChatSession();
  await Promise.all([
    loadCaptures(),
    loadIndexStatus(),
    loadChatSessionsCache().catch(() => {})
  ]);
  textarea.focus();
}

function initTaskView() {
  const storedTaskView = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
  state.taskView = storedTaskView === "list" || storedTaskView === "matrix" ? storedTaskView : "matrix";
}

function showApp() {
  const gate = document.querySelector("#auth-gate");
  const shell = document.querySelector(".app-shell");
  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
  document.body.classList.remove("gate-open");
}

async function gateAuth() {
  if (!state.config?.authRequired) { showApp(); return true; }
  const gate = document.querySelector("#auth-gate");
  if (!gate) { showApp(); return true; }

  if (state.authUser?.authenticated) {
    showApp();
    return true;
  }

  if (state.authSecret && !state.config.githubAvailable) {
    showApp();
    return true;
  }

  document.body.classList.add("gate-open");

  if (state.config.githubAvailable) {
    renderGate("github");
    document.querySelector("#auth-gate-login")?.addEventListener("click", () => {
      window.location.href = "/auth/login";
    });
    return new Promise(() => {});
  }

  renderGate("passcode");
  return new Promise((resolve) => {
    const input = document.querySelector("#auth-gate-secret");
    const button = document.querySelector("#auth-gate-submit");
    const errorEl = document.querySelector("#auth-gate-error");

    const submit = async () => {
      const secret = input?.value?.trim() || "";
      if (!secret) return;
      try {
        const res = await fetch("/api/auth/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Second-Brain-Secret": secret
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid passcode.");
        state.authSecret = secret;
        try {
          window.localStorage.setItem(APP_SECRET_STORAGE_KEY, secret);
        } catch {}
        showApp();
        renderAuthState();
        resolve(true);
      } catch (error) {
        if (errorEl) {
          errorEl.textContent = error.message;
          errorEl.hidden = false;
        }
        if (input) {
          input.value = "";
          input.focus();
        }
        state.authSecret = "";
      }
    };

    button?.addEventListener("click", submit);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
    setTimeout(() => input?.focus(), 100);
  });
}

function renderGate(mode) {
  const githubBlock = document.querySelector("#auth-gate-github");
  const passcodeBlock = document.querySelector("#auth-gate-passcode");
  if (mode === "github") {
    if (githubBlock) githubBlock.hidden = false;
    if (passcodeBlock) passcodeBlock.hidden = true;
  } else {
    if (githubBlock) githubBlock.hidden = true;
    if (passcodeBlock) passcodeBlock.hidden = false;
  }
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
    setComposerFocus(true);
    autoResize(textarea);
  });
  textarea.addEventListener("pointerdown", () => setComposerFocus(true));
  textarea.addEventListener("focus", () => setComposerFocus(true));
  textarea.addEventListener("blur", () => window.setTimeout(() => setComposerFocus(false), 80));

  editText?.addEventListener("input", () => {
    autoResize(editText);
  });

  deepWorkGoalInput?.addEventListener("input", () => {
    autoResize(deepWorkGoalInput);
  });
  deepWorkRecapInput?.addEventListener("input", () => {
    autoResize(deepWorkRecapInput);
  });

  chatText?.addEventListener("input", () => {
    setComposerFocus(true);
    autoResize(chatText);
    updateChatSuggestions();
    scheduleSuggestedChatContext();
  });
  chatText?.addEventListener("pointerdown", () => setComposerFocus(true));
  chatText?.addEventListener("focus", () => {
    setComposerFocus(true);
    scheduleChatScrollToBottom();
  });
  chatText?.addEventListener("blur", () => window.setTimeout(() => setComposerFocus(false), 80));

  chatText?.addEventListener("click", updateChatSuggestions);
  chatText?.addEventListener("blur", () => {
    window.setTimeout(closeChatSuggestions, 120);
  });

  captureSpeechButton?.addEventListener("click", () => toggleSpeechInput("capture"));
  chatSpeechButton?.addEventListener("click", () => toggleSpeechInput("chat"));

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

  chatActionsTrigger?.addEventListener("click", () => {
    openChatActionsSheet();
  });

  chatSaveSummaryButton?.addEventListener("click", async () => {
    closeChatActionsSheet();
    await saveCurrentChatSessionSummary();
  });

  chatExtractTodosButton?.addEventListener("click", async () => {
    closeChatActionsSheet();
    await extractCurrentChatTodos();
  });

  chatCreateNoteButton?.addEventListener("click", async () => {
    closeChatActionsSheet();
    await createCurrentChatStructuredNote();
  });

  chatActionsCancelButtons.forEach((button) => {
    button.addEventListener("click", closeChatActionsSheet);
  });

  deepWorkToggle?.addEventListener("click", () => {
    openDeepWorkSheet();
  });

  deepWorkConfirmButton?.addEventListener("click", async () => {
    await saveDeepWorkGoal();
  });

  deepWorkStopButton?.addEventListener("click", async () => {
    await stopDeepWork();
  });

  deepWorkCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeDeepWorkSheet());
  });

  contextCancelButtons.forEach((button) => {
    button.addEventListener("click", () => closeContextSheet());
  });

  contextSheet?.addEventListener("click", handleContextSheetClick);

  chatSessionHistoryButton?.addEventListener("click", async () => {
    await toggleChatSessionPicker();
  });

  chatSessionPopover?.addEventListener("click", handleChatSessionPickerClick);
  chatSessionPopover?.addEventListener("input", handleChatSessionPickerInput);

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

  todoEffortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const effort = button.dataset.todoEffort || "";
      state.todoEffort = state.todoEffort === effort ? "" : effort;
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
      due: todoDueInput?.value || "",
      effort: state.todoEffort
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

  const settingsLoginButton = document.querySelector("#settings-login-button");
  settingsLoginButton?.addEventListener("click", login);

  const settingsLogoutButton = document.querySelector("#settings-logout-button");
  settingsLogoutButton?.addEventListener("click", logout);

  const authLoginButton = document.querySelector("#auth-login-button");
  authLoginButton?.addEventListener("click", login);

  const authLogoutButton = document.querySelector("#auth-logout-button");
  authLogoutButton?.addEventListener("click", logout);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && chatActionsSheet && !chatActionsSheet.hidden) {
      closeChatActionsSheet();
      return;
    }
    if (event.key === "Escape" && state.chatSessionPickerOpen) {
      closeChatSessionPicker();
      return;
    }
    if (event.key === "Escape" && editSheet && !editSheet.hidden) {
      closeEditSheet();
      return;
    }
    if (event.key === "Escape" && authSheet && !authSheet.hidden) {
      closeAuthSheet();
      return;
    }
    if (event.key === "Escape" && contextSheet && !contextSheet.hidden) {
      closeContextSheet();
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

  sprintRefreshButton?.addEventListener("click", async () => {
    await loadPersonalSprint();
  });

  sprintCategorizeButton?.addEventListener("click", async () => {
    await openSprintCategorizeSession();
  });

  actionToast?.addEventListener("click", async (event) => {
    const undoButton = event.target.closest("[data-undo-task]");
    if (!undoButton) return;
    event.preventDefault();
    await toggleTaskStatus(undoButton.dataset.undoTask, "open", { showUndo: false });
    hideToast();
  });

  tasksList?.addEventListener("click", handleTaskActionClick);
  tasksList?.addEventListener("pointerdown", handleTaskPointerDown);
  tasksList?.addEventListener("pointermove", handleTaskPointerMove);
  tasksList?.addEventListener("pointerup", handleTaskPointerUp);
  tasksList?.addEventListener("pointercancel", resetTaskSwipe);
  sprintContent?.addEventListener("click", handleSprintClick);
  sprintContent?.addEventListener("change", handleSprintChange);
  sprintViewToggle?.addEventListener("click", handleSprintClick);
  chatTimeline?.addEventListener("click", handleChatTimelineClick);
  chatSuggestions?.addEventListener("mousedown", handleChatSuggestionPointer);
  chatContextPanel?.addEventListener("click", handleChatContextPanelClick);
  chatSuggestedContext?.addEventListener("click", handleSuggestedChatContextClick);
  tasksList?.addEventListener("dblclick", handleTaskEditDoubleClick);
  timeline?.addEventListener("change", handleCaptureCategoryChange);
  timeline?.addEventListener("pointerdown", handleCapturePointerDown);
  timeline?.addEventListener("pointermove", handleCapturePointerMove);
  timeline?.addEventListener("pointerup", handleCapturePointerUp);
  timeline?.addEventListener("pointercancel", resetCaptureSwipe);
  timeline?.addEventListener("dblclick", handleCaptureEditDoubleClick);
  [taskFocusFilter, taskScopeFilter, taskSourceFilter].forEach((select) => {
    select?.addEventListener("change", async () => {
      readTaskFiltersFromControls();
      renderTaskFilterState();
      await loadTasks();
    });
  });

  taskViewButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const nextView = button.dataset.taskView || "matrix";
      if (nextView === state.taskView) return;
      state.taskView = nextView === "list" ? "list" : "matrix";
      window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, state.taskView);
      renderTaskFilterState();
      await loadTasks();
    });
  });

  taskFilterClearButton?.addEventListener("click", async () => {
    resetTaskFilters();
    renderTaskFilterState();
    await loadTasks();
  });

  taskFilterToggle?.addEventListener("click", () => {
    setTaskFiltersOpen(taskFilterPanel?.hidden ?? true);
  });

  captureViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.captureView = button.dataset.captureView || "today";
      renderCaptureViewState();
      renderTimeline();
    });
  });

  dashboardOverview?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-cadence-prompt]");
    if (actionButton) {
      event.preventDefault();
      startChatWithPrompt(actionButton.dataset.cadencePrompt || "");
      return;
    }

    const noteButton = event.target.closest("[data-open-note]");
    if (noteButton) {
      event.preventDefault();
      openObsidianNote(noteButton.dataset.openNote || "");
    }
  });

  dashboardDeepWork?.addEventListener("click", async (event) => {
    const resumeButton = event.target.closest("[data-deep-work-resume]");
    if (resumeButton) {
      event.preventDefault();
      await resumeDeepWorkSession(resumeButton.dataset.deepWorkResume || "", resumeButton.dataset.deepWorkGoal || "");
      return;
    }

    const chatButton = event.target.closest("[data-deep-work-chat]");
    if (chatButton) {
      event.preventDefault();
      openDeepWorkSessionInChat(chatButton.dataset.deepWorkChat || "", chatButton.dataset.deepWorkGoal || "");
      return;
    }

    const noteButton = event.target.closest("[data-open-note]");
    if (noteButton) {
      event.preventDefault();
      openObsidianNote(noteButton.dataset.openNote || "");
    }
  });

  dashboardDeepWorkRefresh?.addEventListener("click", loadDashboard);

  dashboardCadenceToggle?.addEventListener("click", () => {
    state.dashboardShowAllCadence = !state.dashboardShowAllCadence;
    renderDashboard();
  });

  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runSearch();
  });
}

function initMobileViewport() {
  const updateViewport = () => {
    const active = document.activeElement;
    const inputFocused = active === textarea || active === chatText || active?.tagName === "TEXTAREA" || active?.tagName === "INPUT";
    const height = window.innerHeight || document.documentElement.clientHeight;
    if (!appViewportHeight || !inputFocused || height > appViewportHeight) {
      appViewportHeight = height;
    }
    document.documentElement.style.setProperty("--app-height", `${Math.round(appViewportHeight)}px`);
  };
  updateViewport();
  window.addEventListener("resize", updateViewport, { passive: true });
  window.addEventListener("orientationchange", () => {
    appViewportHeight = 0;
    updateViewport();
  }, { passive: true });
  window.visualViewport?.addEventListener("resize", () => {
    updateViewport();
    scheduleChatScrollToBottom();
  }, { passive: true });
  window.visualViewport?.addEventListener("scroll", () => {
    updateViewport();
    scheduleChatScrollToBottom();
  }, { passive: true });
}

function scheduleChatScrollToBottom() {
  const activeTab = document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel;
  if (!chatTimeline || activeTab !== "chat") return;
  window.requestAnimationFrame(() => {
    chatTimeline.scrollTop = chatTimeline.scrollHeight;
  });
}

function setComposerFocus(isFocused) {
  if (!captureScreen) return;
  const active = document.activeElement;
  const composerStillFocused = active === textarea || active === chatText;
  captureScreen.classList.toggle("is-composing", Boolean(isFocused || composerStillFocused));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js")
    .then((registration) => registration.update().catch(() => {}))
    .catch(() => {
      // PWA install support is a convenience; the app should stay quiet if registration is blocked.
    });
}

function initAuth() {
  try {
    state.authSecret = window.localStorage.getItem(APP_SECRET_STORAGE_KEY) || "";
  } catch {
    state.authSecret = "";
  }
  state.authUser = null;
}

function initDeepWork() {
  try {
    state.deepWorkGoal = window.localStorage.getItem(DEEP_WORK_GOAL_STORAGE_KEY) || "";
    state.deepWorkSessionPath = window.localStorage.getItem(DEEP_WORK_SESSION_STORAGE_KEY) || "";
    state.deepWorkEnabled = window.localStorage.getItem(DEEP_WORK_ENABLED_STORAGE_KEY) === "true" && Boolean(state.deepWorkGoal.trim());
  } catch {
    state.deepWorkGoal = "";
    state.deepWorkSessionPath = "";
    state.deepWorkEnabled = false;
  }
  renderDeepWorkState();
}

function initChatContextMemory() {
  try {
    const items = JSON.parse(window.localStorage.getItem(RECENT_CONTEXT_STORAGE_KEY) || "[]");
    state.recentChatContext = Array.isArray(items) ? items.slice(0, RECENT_CONTEXT_LIMIT) : [];
  } catch {
    state.recentChatContext = [];
  }
  try {
    const items = JSON.parse(window.localStorage.getItem(PINNED_CONTEXT_STORAGE_KEY) || "[]");
    state.pinnedChatContext = Array.isArray(items) ? items.slice(0, PINNED_CONTEXT_LIMIT) : [];
  } catch {
    state.pinnedChatContext = [];
  }
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.speech.supported = Boolean(SpeechRecognition);
  [captureSpeechButton, chatSpeechButton].forEach((button) => {
    if (button) button.hidden = !state.speech.supported;
    button?.closest(".input-row")?.classList.toggle("has-speech", state.speech.supported);
  });
}

function toggleSpeechInput(target) {
  if (!state.speech.supported) {
    flashSpeechStatus(target, "Voice input is not supported in this browser.");
    return;
  }
  if (state.speech.activeTarget === target) {
    stopSpeechInput();
    return;
  }
  startSpeechInput(target);
}

function startSpeechInput(target) {
  stopSpeechInput({ silent: true });
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = getSpeechInput(target);
  if (!SpeechRecognition || !input) return;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  state.speech.activeTarget = target;
  state.speech.recognition = recognition;
  state.speech.baseText = input.value || "";
  state.speech.finalText = "";
  renderSpeechState();
  flashSpeechStatus(target, "Listening...");

  recognition.onresult = (event) => {
    let interimText = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript || "";
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }
    if (finalText) {
      state.speech.finalText = mergeSpeechText(state.speech.finalText, finalText);
    }
    applySpeechText(target, mergeSpeechText(state.speech.finalText, interimText));
  };

  recognition.onerror = (event) => {
    const message = event.error === "not-allowed"
      ? "Microphone permission was blocked."
      : "Voice input stopped.";
    flashSpeechStatus(target, message);
  };

  recognition.onend = () => {
    const endedTarget = state.speech.activeTarget;
    state.speech.recognition = null;
    state.speech.activeTarget = "";
    state.speech.baseText = "";
    state.speech.finalText = "";
    renderSpeechState();
    if (endedTarget) flashSpeechStatus(endedTarget, "Voice input ended.");
  };

  try {
    recognition.start();
  } catch {
    stopSpeechInput();
  }
}

function stopSpeechInput({ silent = false } = {}) {
  const recognition = state.speech.recognition;
  const target = state.speech.activeTarget;
  state.speech.recognition = null;
  state.speech.activeTarget = "";
  state.speech.baseText = "";
  state.speech.finalText = "";
  renderSpeechState();
  if (recognition) {
    recognition.onend = null;
    recognition.stop();
  }
  if (!silent && target) flashSpeechStatus(target, "Voice input stopped.");
}

function getSpeechInput(target) {
  return target === "chat" ? chatText : textarea;
}

function applySpeechText(target, speechText) {
  const input = getSpeechInput(target);
  if (!input) return;
  input.value = mergeSpeechText(state.speech.baseText, speechText);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

function mergeSpeechText(left, right) {
  return [String(left || "").trimEnd(), String(right || "").trim()].filter(Boolean).join(" ");
}

function renderSpeechState() {
  const active = state.speech.activeTarget;
  [
    [captureSpeechButton, "capture"],
    [chatSpeechButton, "chat"]
  ].forEach(([button, target]) => {
    if (!button) return;
    const isActive = active === target;
    button.classList.toggle("is-listening", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.setAttribute("aria-label", isActive
      ? `Stop ${target === "chat" ? "chat" : "capture"} dictation`
      : `Dictate ${target === "chat" ? "chat message" : "capture"}`);
  });
}

function flashSpeechStatus(target, message) {
  if (target === "chat") {
    flashChatHelper(message);
  } else {
    flashHelper(message);
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
  if (!authSheet) return;
  authSheet.hidden = false;
  document.body.classList.add("sheet-open");

  const passcodeFields = document.querySelector("#auth-passcode-fields");
  const githubInfo = document.querySelector("#auth-github-info");
  const confirmBtn = document.querySelector("#auth-confirm");
  const loginBtn = document.querySelector("#auth-login-button");
  const logoutBtn = document.querySelector("#auth-logout-button");
  const userInfo = document.querySelector("#auth-user-info");

  if (state.config?.githubAvailable) {
    if (passcodeFields) passcodeFields.hidden = true;
    if (githubInfo) githubInfo.hidden = false;
    if (confirmBtn) confirmBtn.hidden = true;
    if (loginBtn) {
      loginBtn.hidden = false;
      loginBtn.textContent = state.authUser?.authenticated ? "Re-authenticate" : "Login with GitHub";
    }
    if (logoutBtn) logoutBtn.hidden = !state.authUser?.authenticated;
    if (userInfo) {
      userInfo.textContent = state.authUser?.authenticated
        ? `Logged in as ${state.authUser.name || state.authUser.login}`
        : "You need to authenticate to write to the vault.";
    }
    requestAnimationFrame(() => loginBtn?.focus());
    return;
  }

  if (passcodeFields) passcodeFields.hidden = false;
  if (githubInfo) githubInfo.hidden = true;
  if (confirmBtn) confirmBtn.hidden = false;
  if (loginBtn) loginBtn.hidden = true;
  if (logoutBtn) logoutBtn.hidden = true;
  const authInput = document.querySelector("#auth-secret");
  if (authInput) {
    authInput.value = state.authSecret || "";
    requestAnimationFrame(() => {
      authInput.focus();
      authInput.select();
    });
  }
}

function closeAuthSheet() {
  if (!authSheet) return;
  authSheet.hidden = true;
  document.body.classList.remove("sheet-open");
}

async function checkAuth() {
  state.authUser = null;
  try {
    const data = await getJson("/api/auth/me");
    if (data?.authenticated) {
      state.authUser = data;
      renderAuthState();
      return;
    }
  } catch {
    // Not authenticated — fall through
  }
  renderAuthState();
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.authUser?.authenticated);
  const githubAvailable = Boolean(state.config?.githubAvailable);

  const settingsLoginButton = document.querySelector("#settings-login-button");
  const settingsLogoutButton = document.querySelector("#settings-logout-button");
  const authRow = document.querySelector("#auth-row");
  const authDescription = document.querySelector("#auth-description");

  if (authRow) authRow.hidden = !(githubAvailable || state.authUser);

  if (settingsLoginButton) {
    settingsLoginButton.hidden = !githubAvailable || isLoggedIn;
    settingsLoginButton.disabled = false;
  }
  if (settingsLogoutButton) {
    settingsLogoutButton.hidden = !isLoggedIn;
    settingsLogoutButton.disabled = false;
  }
  if (authDescription) {
    if (isLoggedIn) {
      authDescription.textContent = `Logged in as ${state.authUser.name || state.authUser.login}`;
    } else if (githubAvailable) {
      authDescription.textContent = "Login with GitHub to enable write access.";
    } else {
      authDescription.textContent = "Write auth via app passcode.";
    }
  }
}

async function login() {
  if (!state.config?.githubAvailable) return;
  window.location.href = "/auth/login";
}

async function logout() {
  try {
    await postJson("/auth/logout", {});
    state.authUser = null;
    renderAuthState();
    flashHelper("Logged out.");
  } catch (error) {
    flashHelper(error.message);
  }
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
  const gate = document.querySelector("#auth-gate");
  if (gate && !gate.hidden && state.config?.authRequired) return;

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
  }

  if (tab === "tasks") {
    loadTasks();
  }

  if (tab === "sprint") {
    loadPersonalSprint();
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
    if (vaultName) vaultName.textContent = config.vaultName;
    if (currentMonth) currentMonth.textContent = config.currentMonth;
    if (chatStatus) chatStatus.textContent = config.chat?.enabled ? getActiveChatModel() : "API key needed";
    if (helperLine) helperLine.textContent = "";
    renderChatThinkingState();
    renderSettingsDetails(config);
  } catch (error) {
    if (helperLine) helperLine.textContent = error.message;
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

function renderDeepWorkState() {
  if (deepWorkToggle) {
    deepWorkToggle.classList.toggle("is-active", state.deepWorkEnabled);
    deepWorkToggle.setAttribute("aria-pressed", String(state.deepWorkEnabled));
    const goal = String(state.deepWorkGoal || "").trim();
    deepWorkToggle.title = state.deepWorkEnabled && goal ? `Deep Work active: ${goal}` : "Start Deep Work";
    deepWorkToggle.innerHTML = state.deepWorkEnabled
      ? `<span class="deep-work-dot" aria-hidden="true"></span><span>Focus</span><strong>${escapeHtml(clipUiText(goal, 26))}</strong>`
      : `<span class="deep-work-dot" aria-hidden="true"></span><span>Deep Work</span><strong>Off</strong>`;
  }
  renderChat();
}

function getDeepWorkPayload() {
  const goal = String(state.deepWorkGoal || "").trim();
  return {
    enabled: Boolean(state.deepWorkEnabled && goal),
    goal,
    sessionPath: state.deepWorkSessionPath || ""
  };
}

function openDeepWorkSheet() {
  if (!deepWorkSheet) return;
  if (deepWorkGoalInput) {
    deepWorkGoalInput.value = state.deepWorkGoal || "";
    autoResize(deepWorkGoalInput);
  }
  if (deepWorkRecapInput) {
    deepWorkRecapInput.value = "";
    autoResize(deepWorkRecapInput);
  }
  if (deepWorkRecapField) deepWorkRecapField.hidden = !state.deepWorkEnabled;
  if (deepWorkCaptureRow) deepWorkCaptureRow.hidden = !state.deepWorkEnabled;
  if (deepWorkCaptureReflection) deepWorkCaptureReflection.checked = true;
  if (deepWorkStopButton) deepWorkStopButton.hidden = !state.deepWorkEnabled;
  if (deepWorkConfirmButton) deepWorkConfirmButton.textContent = state.deepWorkEnabled ? "Update" : "Start";
  deepWorkSheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => deepWorkGoalInput?.focus());
}

function closeDeepWorkSheet() {
  if (!deepWorkSheet) return;
  deepWorkSheet.hidden = true;
  document.body.classList.remove("sheet-open");
  chatText?.focus();
}

async function saveDeepWorkGoal() {
  const goal = String(deepWorkGoalInput?.value || "").trim();
  if (!goal) {
    flashChatHelper("Add a Deep Work goal first.");
    deepWorkGoalInput?.focus();
    return;
  }
  if (deepWorkConfirmButton) deepWorkConfirmButton.disabled = true;
  try {
    const data = await postJson("/api/deep-work/start", {
      goal,
      sessionPath: state.deepWorkSessionPath || ""
    });
    state.deepWorkSessionPath = data.path || state.deepWorkSessionPath || "";
  } catch (error) {
    flashChatHelper(error.message);
    deepWorkGoalInput?.focus();
    if (deepWorkConfirmButton) deepWorkConfirmButton.disabled = false;
    return;
  }
  state.deepWorkGoal = goal;
  state.deepWorkEnabled = true;
  try {
    window.localStorage.setItem(DEEP_WORK_GOAL_STORAGE_KEY, goal);
    window.localStorage.setItem(DEEP_WORK_ENABLED_STORAGE_KEY, "true");
    if (state.deepWorkSessionPath) window.localStorage.setItem(DEEP_WORK_SESSION_STORAGE_KEY, state.deepWorkSessionPath);
  } catch {
    // In-memory mode still works.
  }
  if (deepWorkConfirmButton) deepWorkConfirmButton.disabled = false;
  closeDeepWorkSheet();
  renderDeepWorkState();
  flashChatHelper("Deep Work mode active.");
}

async function stopDeepWork() {
  const sessionPath = state.deepWorkSessionPath || "";
  const recap = String(deepWorkRecapInput?.value || "").trim();
  const captureReflection = Boolean(deepWorkCaptureReflection?.checked && recap);
  if (deepWorkStopButton) deepWorkStopButton.disabled = true;
  if (sessionPath) {
    try {
      await postJson("/api/deep-work/stop", {
        sessionPath,
        recap,
        captureReflection
      });
    } catch (error) {
      flashChatHelper(error.message);
      if (deepWorkStopButton) deepWorkStopButton.disabled = false;
      return;
    }
  }
  state.deepWorkEnabled = false;
  state.deepWorkSessionPath = "";
  try {
    window.localStorage.setItem(DEEP_WORK_ENABLED_STORAGE_KEY, "false");
    window.localStorage.removeItem(DEEP_WORK_SESSION_STORAGE_KEY);
  } catch {
    // In-memory mode still works.
  }
  if (deepWorkStopButton) deepWorkStopButton.disabled = false;
  closeDeepWorkSheet();
  renderDeepWorkState();
  flashChatHelper(captureReflection ? "Deep Work ended · reflection captured." : "Deep Work mode off.");
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
    const session = data.session || null;
    if (!isAutoResumableChatSession(session)) {
      forgetStoredChatSession();
      state.chatSession = null;
      state.chatMessages = [];
      renderChat();
      renderChatSessionState();
      return;
    }
    state.chatSession = session;
    upsertChatSession(state.chatSession);
    state.chatMessages = (data.messages || []).filter((message) => message.content);
    renderChat();
    renderChatSessionState();
    flashChatHelper(state.chatSession?.title ? `Loaded ${state.chatSession.title}.` : "Loaded session.");
  } catch (error) {
    forgetStoredChatSession();
    state.chatSession = null;
    state.chatMessages = [];
    renderChat();
    renderChatSessionState();
    flashChatHelper(error.message);
  }
}

function isAutoResumableChatSession(session) {
  const createdAt = new Date(session?.created || "");
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() <= CHAT_AUTO_RESUME_MS;
}

function forgetStoredChatSession() {
  try {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
  } catch {
    // The in-memory chat state still resets cleanly.
  }
}

async function startNewChatSession() {
  closeChatSessionPicker();
  state.chatSession = null;
  state.chatMessages = [];
  forgetStoredChatSession();
  renderChat();
    renderChatSessionState();
    renderChatSessionActionsState();
    flashChatHelper("New session ready.");
  chatText?.focus();
}

async function startChatWithDraft(message, contextItems = []) {
  await startNewChatSession();
  state.chatContext = (contextItems || []).map((item) => normalizeChatContextItem(item, item.kind || "file", ""));
  renderChatContextPanel();
  if (chatText) {
    chatText.value = message || "";
    autoResize(chatText);
  }
  scheduleSuggestedChatContext();
  setActiveTab("chat");
  chatText?.focus();
}

async function startChatWithPrompt(message, contextItems = []) {
  await startChatWithDraft(message, contextItems);
  await submitChat();
}

async function toggleChatSessionPicker() {
  if (state.chatSessionPickerOpen) {
    closeChatSessionPicker();
    return;
  }
  state.chatSessionPickerOpen = true;
  const canRenderFromCache = state.chatSessionsLoaded || state.chatSessions.length > 0;
  renderChatSessionPicker({ loading: !canRenderFromCache });
  try {
    await loadChatSessionsCache();
    if (state.chatSessionPickerOpen) renderChatSessionResults();
  } catch (error) {
    if (state.chatSessionPickerOpen) renderChatSessionResults({ error: error.message });
  }
}

async function loadChatSessionsCache() {
  if (state.chatSessionsRequest) return state.chatSessionsRequest;
  state.chatSessionsLoading = true;
  state.chatSessionsRequest = (async () => {
    const data = await protectedGetJson("/api/chat/sessions?limit=30");
    state.chatSessions = data.sessions || [];
    state.chatSessionsLoaded = true;
    upsertChatSession(state.chatSession);
  })();
  try {
    await state.chatSessionsRequest;
  } finally {
    state.chatSessionsLoading = false;
    state.chatSessionsRequest = null;
  }
}

function closeChatSessionPicker() {
  state.chatSessionPickerOpen = false;
  state.chatSessionQuery = "";
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
  chatSessionPopover.innerHTML = `
    <button class="session-backdrop" type="button" data-session-close aria-label="Close chat sessions"></button>
    <aside class="session-drawer" role="dialog" aria-modal="true" aria-label="Chat sessions">
      <div class="session-drawer-top">
        <button class="session-icon-button" type="button" data-session-close aria-label="Close chat sessions">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span class="session-drawer-spacer"></span>
      </div>

      <button class="session-drawer-action" type="button" data-session-new>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5h7m-7 14h7M5 12h14M5 5h2m-2 14h2" />
        </svg>
        <span>New chat</span>
      </button>

      <label class="session-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
        <input data-session-search type="search" placeholder="Search" value="${escapeHtml(state.chatSessionQuery)}" autocomplete="off" />
      </label>

      <div class="session-drawer-section" data-session-results>
        ${renderChatSessionListMarkup({ loading, error })}
      </div>
    </aside>
  `;
}

function getFilteredChatSessions() {
  const allSessions = state.chatSessions || [];
  const query = state.chatSessionQuery.trim().toLowerCase();
  if (!query) return allSessions;
  return allSessions.filter((session) => {
    const haystack = [
      session.title,
      session.path,
      formatSessionUpdated(session.updated || session.created)
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function renderChatSessionListMarkup({ loading = false, error = "" } = {}) {
  const query = state.chatSessionQuery.trim();
  const sessions = getFilteredChatSessions();
  return `
    <div class="session-section-title">Chats</div>
    ${loading ? `<p class="session-empty">Loading sessions...</p>` : ""}
    ${error ? `<p class="session-empty">${escapeHtml(error)}</p>` : ""}
    ${!loading && !error && sessions.length ? renderChatSessionGroups(sessions) : ""}
    ${!loading && !error && !sessions.length ? `<p class="session-empty">${query ? "No matching chats." : "No saved sessions yet."}</p>` : ""}
  `;
}

function renderChatSessionGroups(sessions) {
  const groups = groupChatSessions(sessions);
  return groups.map((group) => `
    <div class="session-group">
      <div class="session-group-title">${escapeHtml(group.label)}</div>
      <div class="session-list">
        ${group.sessions.map(renderChatSessionOption).join("")}
      </div>
    </div>
  `).join("");
}

function groupChatSessions(sessions) {
  const today = [];
  const thisWeek = [];
  const older = [];
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startToday);
  weekAgo.setDate(weekAgo.getDate() - 6);

  for (const session of sessions) {
    const date = new Date(session.updated || session.created || "");
    if (!Number.isNaN(date.getTime()) && date >= startToday) {
      today.push(session);
    } else if (!Number.isNaN(date.getTime()) && date >= weekAgo) {
      thisWeek.push(session);
    } else {
      older.push(session);
    }
  }

  return [
    { label: "Today", sessions: today },
    { label: "This week", sessions: thisWeek },
    { label: "Older", sessions: older }
  ].filter((group) => group.sessions.length);
}

function renderChatSessionResults(options = {}) {
  const results = chatSessionPopover?.querySelector("[data-session-results]");
  if (!results) return;
  results.innerHTML = renderChatSessionListMarkup(options);
}

function renderChatSessionOption(session) {
  const active = state.chatSession?.path === session.path;
  return `
    <div class="session-option ${active ? "is-active" : ""}">
      <button class="session-open" type="button" data-session-path="${escapeHtml(session.path)}">
        <strong>${escapeHtml(session.title || "Untitled session")}</strong>
        <small>${escapeHtml(formatSessionUpdated(session.updated || session.created))}</small>
      </button>
      <div class="session-row-actions" aria-label="Session actions">
        <button type="button" data-session-rename="${escapeHtml(session.path)}" aria-label="Rename ${escapeHtml(session.title || "session")}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m4 20 4.4-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10L4 20Z" />
            <path d="m13.5 7.5 3 3" />
          </svg>
        </button>
        <button type="button" data-session-delete="${escapeHtml(session.path)}" aria-label="Delete ${escapeHtml(session.title || "session")}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

async function handleChatSessionPickerClick(event) {
  const closeButton = event.target.closest("[data-session-close]");
  if (closeButton) {
    event.preventDefault();
    closeChatSessionPicker();
    return;
  }

  const newButton = event.target.closest("[data-session-new]");
  if (newButton) {
    event.preventDefault();
    closeChatSessionPicker();
    startNewChatSession();
    return;
  }

  const renameButton = event.target.closest("[data-session-rename]");
  if (renameButton) {
    event.preventDefault();
    await renameChatSession(renameButton.dataset.sessionRename || "");
    return;
  }

  const deleteButton = event.target.closest("[data-session-delete]");
  if (deleteButton) {
    event.preventDefault();
    await deleteChatSession(deleteButton.dataset.sessionDelete || "");
    return;
  }

  const button = event.target.closest("[data-session-path]");
  if (!button) return;
  event.preventDefault();
  await openChatSession(button.dataset.sessionPath || "");
}

function handleChatSessionPickerInput(event) {
  const input = event.target.closest("[data-session-search]");
  if (!input) return;
  state.chatSessionQuery = input.value || "";
  renderChatSessionResults();
}

async function openChatSession(sessionPath) {
  if (!sessionPath) return;
  try {
    const params = new URLSearchParams({ path: sessionPath });
    const data = await protectedGetJson(`/api/chat/session?${params.toString()}`);
    state.chatSession = data.session || null;
    upsertChatSession(state.chatSession);
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

async function renameChatSession(sessionPath) {
  const session = state.chatSessions.find((item) => item.path === sessionPath);
  const currentTitle = session?.title || state.chatSession?.title || "";
  const title = window.prompt("Rename chat", currentTitle);
  if (title === null) return;
  const nextTitle = title.trim();
  if (!nextTitle) {
    flashChatHelper("Session title cannot be empty.");
    return;
  }
  try {
    const data = await postJson("/api/chat/session/update", {
      path: sessionPath,
      title: nextTitle
    });
    const updated = data.session || { ...session, title: nextTitle };
    upsertChatSession(updated);
    if (state.chatSession?.path === sessionPath) state.chatSession = { ...state.chatSession, ...updated };
    renderChatSessionResults();
    renderChatSessionState();
    flashChatHelper("Session renamed.");
  } catch (error) {
    flashChatHelper(error.message);
  }
}

function upsertChatSession(session) {
  if (!session?.path) return;
  const index = state.chatSessions.findIndex((item) => item.path === session.path);
  if (index >= 0) {
    state.chatSessions[index] = { ...state.chatSessions[index], ...session };
  } else {
    state.chatSessions.unshift(session);
  }
}

async function deleteChatSession(sessionPath) {
  const session = state.chatSessions.find((item) => item.path === sessionPath);
  const title = session?.title || "this chat";
  if (!window.confirm(`Delete "${title}"? This removes the OpenCode session.`)) return;
  try {
    await postJson("/api/chat/session/delete", { path: sessionPath });
    state.chatSessions = state.chatSessions.filter((item) => item.path !== sessionPath);
    if (state.chatSession?.path === sessionPath) {
      state.chatSession = null;
      state.chatMessages = [];
      forgetStoredChatSession();
      renderChat();
      renderChatSessionState();
    }
    renderChatSessionResults();
    flashChatHelper("Session deleted.");
  } catch (error) {
    flashChatHelper(error.message);
  }
}

function renderChatSessionState() {
  if (!chatSessionHistoryButton) return;
  const label = state.chatSession?.title ? `Open chat sessions. Current session: ${state.chatSession.title}` : "Open chat sessions";
  chatSessionHistoryButton.setAttribute("aria-label", label);
  chatSessionHistoryButton.title = state.chatSession?.path || "Sessions";
  renderChatSessionActionsState();
}

function renderChatSessionActionsState() {
  const hasAssistantText = state.chatMessages.some((message) => message.role === "assistant" && !message.isPending && !message.isError && String(message.content || "").trim());
  const disabled = state.chatSummarySaving || state.chatTodosExtracting || state.chatNoteCreating || !hasAssistantText;
  if (chatActionsTrigger) {
    chatActionsTrigger.disabled = false;
    chatActionsTrigger.setAttribute("aria-expanded", String(Boolean(chatActionsSheet && !chatActionsSheet.hidden)));
  }
  if (chatSaveSummaryButton) {
    chatSaveSummaryButton.disabled = disabled;
    chatSaveSummaryButton.textContent = state.chatSummarySaving ? "Saving..." : "Save summary";
  }
  if (chatExtractTodosButton) {
    chatExtractTodosButton.disabled = disabled;
    chatExtractTodosButton.textContent = state.chatTodosExtracting ? "Extracting..." : "Extract todos";
  }
  if (chatCreateNoteButton) {
    chatCreateNoteButton.disabled = disabled;
    chatCreateNoteButton.textContent = state.chatNoteCreating ? "Creating..." : "Create note";
  }
}

function openChatActionsSheet() {
  if (!chatActionsSheet) return;
  chatActionsSheet.hidden = false;
  renderChatSessionActionsState();
}

function closeChatActionsSheet() {
  if (chatActionsSheet) chatActionsSheet.hidden = true;
  if (chatActionsTrigger) chatActionsTrigger.setAttribute("aria-expanded", "false");
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
  addChatContextItem(item, state.chatSuggestions.kind, state.chatSuggestions.trigger);
  const before = chatText.value.slice(0, state.chatSuggestions.start).replace(/[ \t]$/, "");
  const after = chatText.value.slice(state.chatSuggestions.end).replace(/^[ \t]+/, "");
  const separator = before && after && !after.startsWith("\n") ? " " : "";
  chatText.value = `${before}${separator}${after}`;
  const caret = before.length + separator.length;
  chatText.setSelectionRange(caret, caret);
  autoResize(chatText);
  closeChatSuggestions();
  renderChatContextPanel();
  chatText.focus();
}

function addChatContextItem(item, kind, trigger) {
  const normalized = normalizeChatContextItem(item, kind, trigger);
  if (!normalized) return;
  const exists = state.chatContext.some((context) => getChatContextKey(context) === getChatContextKey(normalized));
  if (!exists) state.chatContext.push(normalized);
  rememberChatContextItem(normalized);
}

function normalizeChatContextItem(item, kind, trigger) {
  const normalizedKind = item.kind || kind || getReferenceKindForTrigger(trigger);
  if (!normalizedKind) return null;
  const title = item.title || item.name || item.token || item.path || "Context";
  const name = item.name || item.title || item.token || title;
  const token = item.token || slugifyUiToken(name || title || item.path);
  return {
    id: item.id || item.note_id || item.path || `${normalizedKind}:${token}`,
    kind: normalizedKind,
    title,
    name,
    token,
    path: item.path || "",
    type: item.type || null
  };
}

function getChatContextKey(item) {
  return `${item.kind}:${item.path || item.token || item.name || item.title}`.toLowerCase();
}

function slugifyUiToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderChatContextPanel() {
  if (!chatContextPanel) return;
  const items = state.chatContext || [];
  const pinned = getUnselectedContextItems(state.pinnedChatContext || [], items);
  const recent = getUnselectedContextItems(state.recentChatContext || [], [...items, ...pinned]);
  chatContextPanel.hidden = !items.length && !pinned.length && !recent.length;
  chatContextPanel.innerHTML = items.length || pinned.length || recent.length ? `
    ${items.length ? `
      <button class="chat-context-label" type="button" data-context-details>Context</button>
      <div class="chat-context-chips">
        ${items.map((item) => renderChatContextChip(item, { removable: true })).join("")}
      </div>
    ` : ""}
    ${pinned.length ? `
      <div class="chat-context-recent chat-context-pinned" aria-label="Pinned context">
        <span>Pinned</span>
        ${pinned.slice(0, 5).map((item) => renderMemoryChatContextButton(item, "pinned")).join("")}
      </div>
    ` : ""}
    ${recent.length ? `
      <div class="chat-context-recent" aria-label="Recent context">
        <span>Recent</span>
        ${recent.slice(0, 4).map((item) => renderMemoryChatContextButton(item, "recent")).join("")}
      </div>
    ` : ""}
  ` : "";
}

function getUnselectedContextItems(items, selectedItems) {
  const selectedKeys = new Set((selectedItems || []).map(getChatContextKey));
  return (items || []).filter((item) => !selectedKeys.has(getChatContextKey(item)));
}

function scheduleSuggestedChatContext() {
  window.clearTimeout(scheduleSuggestedChatContext.timer);
  scheduleSuggestedChatContext.timer = window.setTimeout(loadSuggestedChatContext, CHAT_CONTEXT_SUGGEST_DEBOUNCE_MS);
}

async function loadSuggestedChatContext() {
  if (!chatText || !chatSuggestedContext) return;
  const message = String(chatText.value || "").trim();
  if (state.suggestedChatContext.dismissedForMessage !== message) {
    state.suggestedChatContext.dismissedForMessage = message;
    state.suggestedChatContext.dismissedKeys = new Set();
  }
  const hasReferenceToken = /(?:^|\s)[#/@][A-Za-z0-9_-]*$/.test(message.slice(0, chatText.selectionStart || message.length));
  if (message.length < 8 || hasReferenceToken || state.suggestedChatContext.hiddenForMessage === message) {
    state.suggestedChatContext.items = [];
    state.suggestedChatContext.query = "";
    renderSuggestedChatContext();
    return;
  }

  const requestId = state.suggestedChatContext.requestId + 1;
  state.suggestedChatContext.requestId = requestId;
  try {
    const query = getSuggestedContextQuery(message);
    const data = await protectedGetJson(`/api/chat/context-suggestions?q=${encodeURIComponent(query)}`);
    if (requestId !== state.suggestedChatContext.requestId) return;
    state.suggestedChatContext.query = data.query || "";
    state.suggestedChatContext.items = mergeUiContextItems([
      ...getDeepWorkSuggestedContextItems(),
      ...(data.suggestions || [])
    ]);
    renderSuggestedChatContext();
  } catch {
    if (requestId !== state.suggestedChatContext.requestId) return;
    state.suggestedChatContext.items = [];
    renderSuggestedChatContext();
  }
}

function getSuggestedContextQuery(message) {
  return [
    message,
    state.deepWorkEnabled ? state.deepWorkGoal : ""
  ].filter(Boolean).join("\n");
}

function getDeepWorkSuggestedContextItems() {
  if (!state.deepWorkEnabled) return [];
  const items = [];
  if (state.deepWorkSessionPath) {
    items.push({
      id: state.deepWorkSessionPath,
      kind: "file",
      title: "Active Deep Work log",
      name: "Active Deep Work log",
      token: "active-deep-work",
      path: state.deepWorkSessionPath,
      type: "deep-work-session"
    });
  }
  const sprint = state.personalSprint?.sprint;
  if (sprint?.path) {
    items.push({
      id: sprint.path,
      kind: "file",
      title: "Current sprint",
      name: "Current sprint",
      token: "current-sprint",
      path: sprint.path,
      type: "sprint"
    });
  }
  return items;
}

function renderSuggestedChatContext() {
  if (!chatSuggestedContext) return;
  const selected = state.chatContext || [];
  const dismissed = state.suggestedChatContext.dismissedKeys || new Set();
  const suggestions = getUnselectedContextItems(state.suggestedChatContext.items || [], selected)
    .filter((item) => !dismissed.has(getChatContextKey(item)))
    .slice(0, 4);
  chatSuggestedContext.hidden = !suggestions.length;
  chatSuggestedContext.innerHTML = suggestions.length ? `
    <span class="chat-context-label">Suggested</span>
    <div class="chat-context-chips">
      ${suggestions.map(renderSuggestedChatContextButton).join("")}
    </div>
    <button class="chat-context-hide" type="button" data-context-hide-suggestions>Hide</button>
  ` : "";
}

function renderSuggestedChatContextButton(item) {
  const title = item.title || item.name || item.token || item.path || "Context";
  return `
    <button class="chat-context-suggestion" type="button" data-context-suggested="${escapeHtml(getChatContextKey(item))}" title="${escapeHtml(item.path || title)}">
      <span>${escapeHtml(getChatContextPrefix(item.kind))}</span>
      <strong>${escapeHtml(title)}</strong>
    </button>
  `;
}

function renderMemoryChatContextButton(item, source) {
  const title = item.title || item.name || item.token || item.path || "Context";
  return `
    <button type="button" data-context-${escapeHtml(source)}="${escapeHtml(getChatContextKey(item))}" title="${escapeHtml(item.path || title)}">
      <span>${escapeHtml(getChatContextPrefix(item.kind))}</span>
      <strong>${escapeHtml(title)}</strong>
    </button>
  `;
}

function renderChatContextChip(item, { removable = false } = {}) {
  const label = getChatContextPrefix(item.kind);
  const title = item.title || item.name || item.token || item.path || "Context";
  const openNoteAttr = !removable && item.path ? ` data-open-note="${escapeHtml(item.path)}"` : "";
  return `
    <span class="chat-context-chip" title="${escapeHtml(item.path || title)}"${openNoteAttr}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      ${removable ? `<button type="button" data-context-remove="${escapeHtml(getChatContextKey(item))}" aria-label="Remove ${escapeHtml(title)}">×</button>` : ""}
    </span>
  `;
}

function getChatContextPrefix(kind) {
  if (kind === "skill") return "/";
  if (kind === "people") return "@";
  if (kind === "file") return "#";
  if (kind === "mentor") return "#";
  if (kind === "assistant") return "/";
  return "+";
}

function handleChatContextPanelClick(event) {
  const pinnedButton = event.target.closest("[data-context-pinned]");
  if (pinnedButton) {
    const item = findChatContextItemByKey(pinnedButton.dataset.contextPinned, state.pinnedChatContext);
    if (item) {
      addChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
      renderChatContextPanel();
      renderSuggestedChatContext();
    }
    return;
  }
  const recentButton = event.target.closest("[data-context-recent]");
  if (recentButton) {
    const item = findChatContextItemByKey(recentButton.dataset.contextRecent, state.recentChatContext);
    if (item) {
      addChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
      renderChatContextPanel();
      renderSuggestedChatContext();
    }
    return;
  }
  const button = event.target.closest("[data-context-remove]");
  if (button) {
    const key = button.dataset.contextRemove;
    state.chatContext = state.chatContext.filter((item) => getChatContextKey(item) !== key);
    renderChatContextPanel();
    if (contextSheet && !contextSheet.hidden) renderContextSheet();
    return;
  }
  const detailsButton = event.target.closest("[data-context-details]");
  const chip = event.target.closest(".chat-context-chip");
  if (detailsButton || chip) {
    event.preventDefault();
    openContextSheet();
  }
}

function handleSuggestedChatContextClick(event) {
  const hideButton = event.target.closest("[data-context-hide-suggestions]");
  if (hideButton) {
    state.suggestedChatContext.hiddenForMessage = String(chatText?.value || "").trim();
    state.suggestedChatContext.items = [];
    renderSuggestedChatContext();
    chatText?.focus();
    return;
  }
  const button = event.target.closest("[data-context-suggested]");
  if (!button) return;
  const item = findChatContextItemByKey(button.dataset.contextSuggested, state.suggestedChatContext.items);
  if (!item) return;
  addChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
  renderChatContextPanel();
  renderSuggestedChatContext();
  chatText?.focus();
}

function findChatContextItemByKey(key, items = []) {
  return (items || []).find((item) => getChatContextKey(item) === String(key || ""));
}

function mergeUiContextItems(items = []) {
  const merged = new Map();
  for (const item of items) {
    const normalized = normalizeChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
    if (!normalized) continue;
    const key = getChatContextKey(normalized);
    if (!merged.has(key)) merged.set(key, normalized);
  }
  return Array.from(merged.values());
}

function pinChatContextItem(item) {
  const normalized = normalizeChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
  if (!normalized) return;
  const key = getChatContextKey(normalized);
  state.pinnedChatContext = [
    normalized,
    ...(state.pinnedChatContext || []).filter((context) => getChatContextKey(context) !== key)
  ].slice(0, PINNED_CONTEXT_LIMIT);
  savePinnedChatContext();
}

function unpinChatContextItem(key) {
  state.pinnedChatContext = (state.pinnedChatContext || []).filter((item) => getChatContextKey(item) !== key);
  savePinnedChatContext();
}

function isPinnedChatContext(item) {
  const key = getChatContextKey(item);
  return (state.pinnedChatContext || []).some((context) => getChatContextKey(context) === key);
}

function savePinnedChatContext() {
  try {
    window.localStorage.setItem(PINNED_CONTEXT_STORAGE_KEY, JSON.stringify(state.pinnedChatContext || []));
  } catch {
    // Pinned context is a convenience only.
  }
}

function rememberChatContextItem(item) {
  const normalized = normalizeChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
  if (!normalized) return;
  const key = getChatContextKey(normalized);
  state.recentChatContext = [
    normalized,
    ...(state.recentChatContext || []).filter((context) => getChatContextKey(context) !== key)
  ].slice(0, RECENT_CONTEXT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_CONTEXT_STORAGE_KEY, JSON.stringify(state.recentChatContext));
  } catch {
    // Recent context is a convenience only.
  }
}

function openContextSheet() {
  if (!contextSheet) return;
  renderContextSheet();
  contextSheet.hidden = false;
  document.body.classList.add("sheet-open");
}

function closeContextSheet() {
  if (!contextSheet) return;
  contextSheet.hidden = true;
  document.body.classList.remove("sheet-open");
  chatText?.focus();
}

function renderContextSheet() {
  if (!contextDetailList) return;
  const selected = state.chatContext || [];
  const pinned = getUnselectedContextItems(state.pinnedChatContext || [], selected);
  const recent = getUnselectedContextItems(state.recentChatContext || [], [...selected, ...pinned]).slice(0, 6);
  const suggested = getUnselectedContextItems(state.suggestedChatContext.items || [], [...selected, ...pinned, ...recent])
    .filter((item) => !(state.suggestedChatContext.dismissedKeys || new Set()).has(getChatContextKey(item)))
    .slice(0, 6);
  const sections = [
    renderContextDetailSection("Selected", selected, "selected"),
    renderContextDetailSection("Pinned", pinned, "pinned"),
    renderContextDetailSection("Recent", recent, "recent"),
    renderContextDetailSection("Suggested", suggested, "suggested")
  ].filter(Boolean).join("");
  contextDetailList.innerHTML = sections || `
    <p class="quiet-line">No context yet. Use /skill, @person, #file, or suggested chips in the chat box.</p>
  `;
}

function renderContextDetailSection(title, items, source) {
  if (!items?.length) return "";
  return `
    <section class="context-detail-section">
      <h3>${escapeHtml(title)}</h3>
      ${items.map((item) => renderContextDetailItem(item, source)).join("")}
    </section>
  `;
}

function renderContextDetailItem(item, source = "selected") {
  const title = item.title || item.name || item.path || "Context";
  const kind = getReferenceKindSingular(item.kind);
  const key = getChatContextKey(item);
  const pinned = isPinnedChatContext(item);
  return `
    <article class="context-detail-card">
      <div>
        <span>${escapeHtml(getChatContextPrefix(item.kind))} ${escapeHtml(kind)}</span>
        <strong>${escapeHtml(title)}</strong>
        ${item.path ? `<small>${escapeHtml(item.path)}</small>` : `<small>OpenCode skill</small>`}
      </div>
      <div class="context-detail-actions">
        ${item.path ? `<button type="button" data-open-note="${escapeHtml(item.path)}">Open</button>` : ""}
        ${source !== "selected" ? `<button type="button" data-context-add="${escapeHtml(key)}" data-context-source="${escapeHtml(source)}">Add</button>` : ""}
        ${pinned ? `<button type="button" data-context-unpin="${escapeHtml(key)}">Unpin</button>` : `<button type="button" data-context-pin="${escapeHtml(key)}" data-context-source="${escapeHtml(source)}">Pin</button>`}
        ${source === "selected" ? `<button type="button" data-context-remove="${escapeHtml(key)}">Remove</button>` : ""}
        ${source === "suggested" ? `<button type="button" data-context-dismiss="${escapeHtml(key)}">Dismiss</button>` : ""}
      </div>
    </article>
  `;
}

function handleContextSheetClick(event) {
  const addButton = event.target.closest("[data-context-add]");
  if (addButton) {
    const item = findContextItemFromSource(addButton.dataset.contextAdd, addButton.dataset.contextSource);
    if (item) addChatContextItem(item, item.kind, getChatContextPrefix(item.kind));
    renderChatContextPanel();
    renderSuggestedChatContext();
    renderContextSheet();
    return;
  }

  const pinButton = event.target.closest("[data-context-pin]");
  if (pinButton) {
    const item = findContextItemFromSource(pinButton.dataset.contextPin, pinButton.dataset.contextSource) || findContextItemFromSource(pinButton.dataset.contextPin, "selected");
    if (item) pinChatContextItem(item);
    renderChatContextPanel();
    renderSuggestedChatContext();
    renderContextSheet();
    return;
  }

  const unpinButton = event.target.closest("[data-context-unpin]");
  if (unpinButton) {
    unpinChatContextItem(unpinButton.dataset.contextUnpin);
    renderChatContextPanel();
    renderSuggestedChatContext();
    renderContextSheet();
    return;
  }

  const dismissButton = event.target.closest("[data-context-dismiss]");
  if (dismissButton) {
    state.suggestedChatContext.dismissedKeys.add(dismissButton.dataset.contextDismiss);
    renderSuggestedChatContext();
    renderContextSheet();
    return;
  }

  const removeButton = event.target.closest("[data-context-remove]");
  if (removeButton) {
    state.chatContext = state.chatContext.filter((item) => getChatContextKey(item) !== removeButton.dataset.contextRemove);
    renderChatContextPanel();
    renderSuggestedChatContext();
    renderContextSheet();
    return;
  }

  const openButton = event.target.closest("[data-open-note]");
  if (openButton) {
    const notePath = openButton.dataset.openNote || "";
    if (notePath) openObsidianNote(notePath);
  }
}

function findContextItemFromSource(key, source) {
  if (source === "selected") return findChatContextItemByKey(key, state.chatContext);
  if (source === "pinned") return findChatContextItemByKey(key, state.pinnedChatContext);
  if (source === "recent") return findChatContextItemByKey(key, state.recentChatContext);
  if (source === "suggested") return findChatContextItemByKey(key, state.suggestedChatContext.items);
  return findChatContextItemByKey(key, [
    ...(state.chatContext || []),
    ...(state.pinnedChatContext || []),
    ...(state.recentChatContext || []),
    ...(state.suggestedChatContext.items || [])
  ]);
}

function getSelectedChatContext() {
  return (state.chatContext || []).map((item) => ({ ...item }));
}

function buildChatContextPayload(items) {
  const skill = items.find((item) => item.kind === "skill" || item.kind === "assistant" || item.kind === "mentor") || null;
  const people = items.filter((item) => item.kind === "people");
  const files = items.filter((item) => item.kind === "file");
  return {
    skill,
    people,
    files
  };
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
  const ignoreValue = Array.isArray(config.ignoreRules) ? config.ignoreRules.join("\n") : "";
  const ignoreList = Array.isArray(config.ignoreRules)
    ? `
      <details class="settings-ignore">
        <summary>Task-ignored paths <span>${numberFormat(ignoreCount)}</span></summary>
        <textarea data-ignore-rules rows="7" spellcheck="false" placeholder="4.Archive/">${escapeHtml(ignoreValue)}</textarea>
        <div class="settings-actions">
          <button class="secondary-button" type="button" data-ignore-save>Save task ignores</button>
        </div>
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
  const runtime = config.chat?.runtime || {};
  const runtimeLabel = runtime.reachable ? "online" : (runtime.status || "unknown");
  const runtimeDetail = [
    runtime.detail,
    runtime.latencyMs ? `${runtime.latencyMs}ms` : ""
  ].filter(Boolean).join(" · ");
  const operations = config.operations || {};
  const appRuntime = operations.runtime || {};
  const index = operations.index || {};
  const watcherLabel = formatWatcherStatus(index.watcher);
  const runtimeStarted = appRuntime.startedAt ? formatDateTime(appRuntime.startedAt) : "unknown";
  const runtimeUptime = formatDurationSeconds(appRuntime.uptimeSeconds);
  const indexLastRun = index.lastRunAt ? formatDateTime(index.lastRunAt) : "not indexed yet";
  const service = operations.service || {};
  settingsDetails.innerHTML = `
    <div class="settings-health-card">
      <div>
        <span>Runtime</span>
        <strong>${escapeHtml(appRuntime.nodeEnv || "development")} · ${escapeHtml(runtimeUptime || "just started")}</strong>
      </div>
      <div>
        <span>Index watcher</span>
        <strong>${escapeHtml(watcherLabel)}</strong>
      </div>
      <div>
        <span>Chat runtime</span>
        <strong>${escapeHtml(runtimeLabel)}</strong>
      </div>
    </div>
    <div class="settings-grid">
      <div><span>Vault</span><strong>${escapeHtml(config.vaultName)}</strong></div>
      <div><span>Target file</span><strong>${escapeHtml(relativeMonthlyPath(config.targetFile || config.monthlyFile))}</strong></div>
      <div><span>Host</span><strong>${escapeHtml(config.host)}:${escapeHtml(config.port)}</strong></div>
      <div><span>Local URL</span><strong>${escapeHtml(config.localUrl)}</strong></div>
      <div><span>LAN URL</span><strong>${escapeHtml(config.lanUrl || "disabled")}</strong></div>
      <div><span>Write auth</span><strong>${config.authRequired ? "enabled" : "not set"}</strong></div>
      <div><span>Task ignores</span><strong>${numberFormat(ignoreCount)}</strong></div>
      <div class="${runtime.reachable ? "is-ok" : "is-warning"}"><span>${escapeHtml((config.chat?.provider || "chat").toUpperCase())}</span><strong>${escapeHtml(runtimeLabel)}</strong></div>
      <div><span>OpenCode URL</span><strong>${escapeHtml(config.chat?.opencodeBaseUrl || "not used")}</strong></div>
      <div><span>OpenCode agent</span><strong>${escapeHtml(config.chat?.agent || "not used")}</strong></div>
      <div><span>Runtime detail</span><strong>${escapeHtml(runtimeDetail || "not checked")}</strong></div>
      <div><span>Started</span><strong>${escapeHtml(runtimeStarted)}</strong></div>
      <div><span>Node</span><strong>${escapeHtml(appRuntime.nodeVersion || "unknown")}</strong></div>
      <div><span>Process</span><strong>${escapeHtml(appRuntime.pid ? `pid ${appRuntime.pid}` : "unknown")}</strong></div>
      <div><span>Data dir</span><strong>${escapeHtml(appRuntime.dataDir || "unknown")}</strong></div>
      <div><span>Index last run</span><strong>${escapeHtml(indexLastRun)}</strong></div>
      <div><span>Index size</span><strong>${numberFormat(index.noteCount)} notes · ${numberFormat(index.taskCount)} tasks</strong></div>
      <div><span>Watcher debounce</span><strong>${numberFormat(appRuntime.watchDebounceMs)}ms</strong></div>
      <div><span>Service</span><strong>${escapeHtml(service.label || "manual")}</strong></div>
      <div><span>OpenCode service</span><strong>${escapeHtml(service.opencodeAutoStart ? (service.opencodeLabel || "enabled") : "manual")}</strong></div>
      <div><span>OpenCode bind</span><strong>${escapeHtml(service.opencodeAutoStart ? `${service.opencodeHost || "127.0.0.1"}:${service.opencodePort || "4096"}` : "manual")}</strong></div>
      <div><span>OpenCode cwd</span><strong>${escapeHtml(service.opencodeCwd || "vault path")}</strong></div>
    </div>
    ${service.installCommand ? `
      <p class="quiet-line settings-service-line">
        Mac mini service: ${escapeHtml(service.installCommand)} · ${escapeHtml(service.statusCommand || "")} · ${escapeHtml(service.logsCommand || "")}
      </p>
    ` : ""}
    ${backupWarning ? `<p class="warning-line">Backup reminder: ${escapeHtml(backupWarning[0])} has ${escapeHtml(backupWarning[1].summary)}.</p>` : ""}
    ${backupGrid}
    ${ignoreList}
    <div class="settings-actions">
      ${config.authRequired && !config.githubAvailable ? `
        <button class="secondary-button" type="button" data-auth-open>Set/reset app passcode</button>
        <button class="secondary-button" type="button" data-auth-clear>Clear saved passcode</button>
      ` : ""}
      <button class="secondary-button" type="button" data-chat-status-refresh>Refresh status</button>
    </div>
  `;
  settingsDetails.querySelector("[data-auth-open]")?.addEventListener("click", openAuthSheet);
  settingsDetails.querySelector("[data-ignore-save]")?.addEventListener("click", async () => {
    const rules = settingsDetails.querySelector("[data-ignore-rules]")?.value || "";
    try {
      const data = await postJson("/api/settings/ignore-rules", { rules });
      state.config.ignoreRules = data.rules || [];
      renderSettingsDetails(state.config);
      await refreshTaskSurfaces();
      flashHelper("Task ignores saved.");
      showToast("Task ignores saved.");
    } catch (error) {
      flashHelper(error.message);
      showToast(error.message, { duration: 3200 });
    }
  });
  settingsDetails.querySelector("[data-chat-status-refresh]")?.addEventListener("click", async () => {
    await loadConfig();
    flashHelper("Status refreshed.");
  });
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
    renderTasksBadge();
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
      focus: state.taskView === "matrix" ? "all" : state.taskFocus
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
    renderTasksBadge(state.dashboard.taskSummary?.openCount);
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
    await Promise.all([loadTasks(), loadDashboard()]);
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
  const selectedContext = getSelectedChatContext();
  const contextPayload = buildChatContextPayload(selectedContext);

  const userMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: message,
    sources: [],
    context: selectedContext
  };
  state.chatMessages.push(userMessage);
  state.chatSending = true;
  if (chatSendButton) chatSendButton.disabled = true;
  if (chatText) {
    chatText.value = "";
    autoResize(chatText);
  }
  state.chatContext = [];
  renderChatContextPanel();
  state.suggestedChatContext.items = [];
  state.suggestedChatContext.dismissedKeys = new Set();
  renderSuggestedChatContext();
  flashChatHelper("Thinking...");
  renderChat();
  const payloadHistory = state.chatMessages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(0, -1)
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));

  let assistantMessage = null;
  try {
    const session = await ensureChatSessionForSubmit(message, activeSessionPath);
    state.chatSession = session || state.chatSession;
    upsertChatSession(state.chatSession);
    if (state.chatSession?.path) {
      window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, state.chatSession.path);
    }
    renderChatSessionState();

    assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      sources: [],
      mentor: null,
      assistant: null,
      people: [],
      isPending: true,
      sessionPath: state.chatSession?.path || activeSessionPath
    };
    state.chatMessages.push(assistantMessage);
    renderChat();

    const data = await postJson("/api/chat", {
      message,
      history: payloadHistory,
      thinkingMode: state.chatThinkingMode,
      sessionPath: state.chatSession?.path || activeSessionPath,
      deepWork: getDeepWorkPayload(),
      skill: contextPayload.skill,
      people: contextPayload.people,
      files: contextPayload.files
    });
    state.chatSession = data.session || state.chatSession;
    upsertChatSession(state.chatSession);
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
    renderChatSessionActionsState();
  } catch (error) {
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
    state.chatSending = false;
    if (chatSendButton) chatSendButton.disabled = false;
    renderChat();
    renderChatSessionActionsState();
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
  const payload = state.config?.chat?.provider === "opencode"
    ? {}
    : { title: deriveClientChatTitle(message) };
  const data = await postJson("/api/chat/session", payload);
  return data || null;
}

function deriveClientChatTitle(message) {
  return clipUiText(String(message || "").replace(/\s+/g, " ").trim(), 48) || "New chat";
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

async function handleChatTimelineClick(event) {
  handleChatSourceClick(event);
}

async function saveCurrentChatSessionSummary() {
  const transcript = getCurrentChatTranscript();
  if (!transcript) {
    showToast("No chat content to summarize.", { duration: 2200 });
    return;
  }
  const sessionPath = state.chatSession?.path || getActiveChatSessionPath() || "";
  state.chatSummarySaving = true;
  renderChatSessionActionsState();
  showToast("Saving summary...");
  flashChatHelper("Saving summary...");
  try {
    const result = await postJson("/api/chat/capture", {
      category: "thought",
      text: transcript,
      sessionPath
    });
    await loadCaptures();
    if (document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel === "dashboard") {
      await loadDashboard();
    }
    showToast("Chat summary saved.");
    flashChatHelper(`Saved summary to ${relativeMonthlyPath(result.monthlyFile || "")}`);
  } catch (error) {
    showToast(error.message, { duration: 3200 });
    flashChatHelper(error.message);
  } finally {
    state.chatSummarySaving = false;
    renderChatSessionActionsState();
  }
}

async function extractCurrentChatTodos() {
  const transcript = getCurrentChatTranscript();
  if (!transcript) {
    showToast("No chat content to extract.", { duration: 2200 });
    return;
  }
  const sessionPath = state.chatSession?.path || getActiveChatSessionPath() || "";
  state.chatTodosExtracting = true;
  renderChatSessionActionsState();
  try {
    const result = await postJson("/api/chat/extract-todos", {
      text: transcript,
      sessionPath
    });
    await loadCaptures();
    await refreshTaskSurfaces();
    const count = Number(result.count || 0);
    if (count) {
      showToast(`Saved ${count} todo${count === 1 ? "" : "s"}.`);
      flashChatHelper(`Saved ${count} todo${count === 1 ? "" : "s"} to ${relativeMonthlyPath(result.monthlyFile || "")}`);
    } else {
      showToast("No todos found.", { duration: 2200 });
      flashChatHelper("No todos found in this session.");
    }
  } catch (error) {
    showToast(error.message, { duration: 3200 });
    flashChatHelper(error.message);
  } finally {
    state.chatTodosExtracting = false;
    renderChatSessionActionsState();
  }
}

async function createCurrentChatStructuredNote() {
  const transcript = getCurrentChatTranscript();
  if (!transcript) {
    showToast("No chat content to turn into a note.", { duration: 2200 });
    return;
  }
  const sessionPath = state.chatSession?.path || getActiveChatSessionPath() || "";
  state.chatNoteCreating = true;
  renderChatSessionActionsState();
  showToast("Creating note...");
  flashChatHelper("Creating note...");
  try {
    const result = await postJson("/api/chat/create-note", {
      text: transcript,
      sessionPath
    });
    await loadIndexStatus();
    const notePath = result.note?.path || "";
    showToast("Structured note created.");
    flashChatHelper(notePath ? `Created note: ${notePath}` : "Created structured note.");
    if (document.querySelector("[data-tab-panel].is-active")?.dataset.tabPanel === "dashboard") {
      await loadDashboard();
    }
  } catch (error) {
    showToast(error.message, { duration: 3200 });
    flashChatHelper(error.message);
  } finally {
    state.chatNoteCreating = false;
    renderChatSessionActionsState();
  }
}

function getCurrentChatTranscript() {
  const messages = (state.chatMessages || [])
    .filter((message) => !message.isPending && !message.isError && String(message.content || "").trim())
    .filter((message) => message.role === "user" || message.role === "assistant");
  if (!messages.length) return "";
  return messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`).join("\n\n");
}

function handleChatSourceClick(event) {
  const deepWorkButton = event.target.closest("[data-deep-work-edit]");
  if (deepWorkButton) {
    event.preventDefault();
    openDeepWorkSheet();
    return;
  }
  const button = event.target.closest("[data-open-note]");
  if (!button) return;
  event.preventDefault();
  const path = button.dataset.openNote || "";
  if (path) openObsidianNote(path);
}

function openTodoSheet({ mode = "capture", text = "", task = null } = {}) {
  if (!todoSheet) return;
  state.todoSheetMode = mode;
  state.pendingTodoText = text;
  state.pendingTriageTask = task;
  state.todoImportant = task?.important ?? true;
  state.todoUrgent = task?.urgent ?? false;
  state.todoEffort = task?.effort || "";
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
  state.todoEffort = "";
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

  todoEffortButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.todoEffort === state.todoEffort);
  });

  duePresetButtons.forEach((button) => {
    button.classList.toggle("is-active", getDuePresetForValue(todoDueInput?.value || "") === button.dataset.duePreset);
  });
}

async function submitCapture(text, metadata = {}) {
  const captureKey = getCaptureSubmissionKey(text, metadata);
  if (state.captureSaving && state.captureInFlightKey === captureKey) {
    showToast("Already saving that capture.");
    return;
  }
  if (isRecentCaptureDuplicate(captureKey)) {
    showToast("Already saved that capture.");
    return;
  }
  if (state.captureSaving) return;
  state.captureSaving = true;
  state.captureInFlightKey = captureKey;
  setCaptureSavingState(true);
  if (todoConfirmButton) todoConfirmButton.disabled = true;
  if (helperLine) helperLine.textContent = "Saving...";

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
    state.lastCaptureKey = captureKey;
    state.lastCaptureAt = Date.now();
    flashHelper(`Saved to ${relativeMonthlyPath(result.monthlyFile)}`);
    showToast("Saved.");
    textarea.focus();
  } catch (error) {
    flashHelper(error.message);
    showToast(error.message, { duration: 3200 });
  } finally {
    state.pendingChatCaptureSource = "";
    state.captureSaving = false;
    state.captureInFlightKey = "";
    setCaptureSavingState(false);
    if (todoConfirmButton) todoConfirmButton.disabled = false;
  }
}

function setCaptureSavingState(isSaving) {
  if (!sendButton) return;
  sendButton.disabled = isSaving;
  sendButton.classList.toggle("is-saving", isSaving);
  sendButton.setAttribute("aria-busy", isSaving ? "true" : "false");
  sendButton.setAttribute("aria-label", isSaving ? "Saving capture" : "Append capture");
}

function getCaptureSubmissionKey(text, metadata = {}) {
  const normalizedText = String(text || "").trim().replace(/\s+/g, " ");
  const normalizedMetadata = {
    category: state.category,
    source: metadata.source || state.pendingChatCaptureSource || "",
    important: metadata.important ?? "",
    urgent: metadata.urgent ?? "",
    due: metadata.due || "",
    effort: metadata.effort || ""
  };
  return JSON.stringify([normalizedText, normalizedMetadata]);
}

function isRecentCaptureDuplicate(captureKey) {
  return Boolean(captureKey && state.lastCaptureKey === captureKey && Date.now() - state.lastCaptureAt < 5000);
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

function handleTaskPointerDown(event) {
  const row = event.target.closest("[data-task-id]");
  if (!row || event.target.closest("button, select, textarea, input, a")) return;
  row.setPointerCapture?.(event.pointerId);
  state.taskSwipe = {
    id: row.dataset.taskId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: true
  };
  row.classList.add("is-swipe-ready");
}

function handleTaskPointerMove(event) {
  const swipe = state.taskSwipe;
  if (!swipe?.active || swipe.pointerId !== event.pointerId) return;
  const row = tasksList?.querySelector(`[data-task-id="${cssEscape(swipe.id)}"]`);
  if (!row) return;
  const dx = Math.max(0, event.clientX - swipe.startX);
  const dy = Math.abs(event.clientY - swipe.startY);
  if (dy > 42) {
    resetTaskSwipe();
    return;
  }
  if (dx > 10) event.preventDefault();
  row.style.setProperty("--swipe-offset", `${Math.min(dx, 92)}px`);
  row.classList.toggle("is-swiping", dx > 12);
}

async function handleTaskPointerUp(event) {
  const swipe = state.taskSwipe;
  if (!swipe?.active || swipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipe.startX;
  const dy = Math.abs(event.clientY - swipe.startY);
  const task = findTaskById(swipe.id);
  resetTaskSwipe();
  if (task && dx > 86 && dy < 44) {
    event.preventDefault();
    await setDailyFocus(task.text || "", { source: "task" });
    setActiveTab("sprint");
  }
}

function resetTaskSwipe() {
  if (!state.taskSwipe?.id) {
    state.taskSwipe = null;
    return;
  }
  const row = tasksList?.querySelector(`[data-task-id="${cssEscape(state.taskSwipe.id)}"]`);
  if (row) {
    row.classList.remove("is-swipe-ready", "is-swiping");
    row.style.removeProperty("--swipe-offset");
  }
  state.taskSwipe = null;
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

function openObsidianNote(notePath) {
  const cleanPath = String(notePath || "").trim();
  if (!cleanPath) {
    flashHelper("No note path available.");
    return false;
  }

  const url = getObsidianNoteUrl(cleanPath);
  try {
    const opened = window.open(url, "_blank");
    if (opened) {
      flashHelper("Opening note in Obsidian...");
      return true;
    }
  } catch {
    // Fall through to same-tab navigation for browsers that block popups.
  }

  window.location.assign(url);
  flashHelper("Opening note in Obsidian...");
  return true;
}

function renderObsidianNoteLink(notePath, label, title = "") {
  const cleanPath = String(notePath || "").trim();
  if (!cleanPath) return "";
  const linkTitle = title || cleanPath;
  return `
    <a class="note-link-button" href="${escapeHtml(getObsidianNoteUrl(cleanPath))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(linkTitle)}">
      ${escapeHtml(label)}
    </a>
  `;
}

function renderChat() {
  if (!chatTimeline) return;
  const focusCard = renderDeepWorkFocusCard();
  if (!state.chatMessages.length) {
    chatTimeline.innerHTML = `
      ${focusCard}
      <div class="empty-state chat-empty">
        <p class="empty-title">${state.deepWorkEnabled ? "Deep Work is ready." : "Ask the vault."}</p>
        <p>Use /skill, @person, or #file to add focused context.</p>
      </div>
    `;
    return;
  }

  chatTimeline.innerHTML = `${focusCard}${state.chatMessages.map((message) => `
    <article class="chat-message chat-${escapeHtml(message.role)} ${message.isError ? "is-error" : ""} ${message.isPending ? "is-pending" : ""}">
      <div class="chat-message-body">
        <p class="chat-role">${message.role === "user" ? "You" : "Second Brain"}</p>
        ${message.role === "user" ? renderChatMessageContext(message.context) : ""}
        ${message.isPending ? renderTypingIndicator() : `<div class="chat-text">${formatMessageText(message.content)}</div>`}
        ${message.isPending ? "" : renderChatContexts(message)}
        ${message.isPending ? "" : message.sources?.length ? renderChatSources(message.sources) : ""}
      </div>
    </article>
  `).join("")}`;

  requestAnimationFrame(() => {
    chatTimeline.scrollTop = chatTimeline.scrollHeight;
  });
}

function renderDeepWorkFocusCard() {
  if (!state.deepWorkEnabled || !state.deepWorkGoal) return "";
  return `
    <aside class="deep-work-card" aria-label="Deep Work focus">
      <span>Deep Work</span>
      <p>${escapeHtml(state.deepWorkGoal)}</p>
      ${state.deepWorkSessionPath ? `<button type="button" data-open-note="${escapeHtml(state.deepWorkSessionPath)}">Open log</button>` : ""}
      <button type="button" data-deep-work-edit>Edit</button>
    </aside>
  `;
}

function renderTypingIndicator() {
  return `
    <div class="typing-indicator" aria-label="Assistant is thinking">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
}

function renderChatMessageContext(context) {
  const items = Array.isArray(context) ? context : [];
  if (!items.length) return "";
  return `
    <div class="chat-message-context" aria-label="Message context">
      ${items.map((item) => renderChatContextChip(item)).join("")}
    </div>
  `;
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
  return renderSafeMarkdown(value);
}

function renderSafeMarkdown(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(renderMarkdownCodeBlock(code.join("\n"), lang));
      continue;
    }

    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderMarkdownTable(tableLines));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading) {
      const level = Math.min(heading[1].length + 2, 6);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(renderMarkdownQuote(quoteLines));
      continue;
    }

    if (isMarkdownListLine(line)) {
      const ordered = isOrderedMarkdownListLine(line);
      const items = [];
      while (index < lines.length && isMarkdownListLine(lines[index]) && isOrderedMarkdownListLine(lines[index]) === ordered) {
        items.push(lines[index].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ""));
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^#{1,4}\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !isMarkdownTableStart(lines, index) &&
      !isMarkdownListLine(lines[index]) &&
      !/^\s*(?:---|\*\*\*|___)\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
  }

  return blocks.join("");
}

function renderMarkdownCodeBlock(code, lang) {
  const language = lang ? ` data-language="${escapeHtml(lang)}"` : "";
  return `<pre class="chat-code-block"${language}><code>${escapeHtml(code)}</code></pre>`;
}

function renderMarkdownTable(lines) {
  const [headerLine, , ...bodyLines] = lines;
  const headers = splitMarkdownTableRow(headerLine);
  const rows = bodyLines.map(splitMarkdownTableRow);
  return `
    <div class="chat-table-wrap">
      <table class="chat-table">
        <thead>
          <tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${headers.map((_, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function isMarkdownTableStart(lines, index) {
  return isMarkdownTableRow(lines[index]) && isMarkdownTableSeparator(lines[index + 1] || "");
}

function isMarkdownTableRow(line) {
  const trimmed = String(line || "").trim();
  return trimmed.includes("|") && /^\|?.+\|.+\|?$/.test(trimmed);
}

function isMarkdownTableSeparator(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line) {
  let trimmed = String(line || "").trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderMarkdownQuote(lines) {
  const first = lines[0] || "";
  const callout = first.match(/^\[!([A-Za-z0-9_-]+)]\s*(.*)$/);
  if (callout) {
    const [, type, title] = callout;
    const body = lines.slice(1).join("\n").trim();
    return `
      <aside class="chat-callout chat-callout-${escapeHtml(type.toLowerCase())}">
        <p class="chat-callout-title">${escapeHtml(title || type)}</p>
        ${body ? renderSafeMarkdown(body) : ""}
      </aside>
    `;
  }
  return `<blockquote>${renderSafeMarkdown(lines.join("\n"))}</blockquote>`;
}

function isMarkdownListLine(line) {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function isOrderedMarkdownListLine(line) {
  return /^\s*\d+[.)]\s+/.test(line);
}

function renderInlineMarkdown(value) {
  const parts = String(value || "").split(/(`[^`]*`)/g);
  return parts.map((part) => {
    if (/^`[^`]*`$/.test(part)) {
      return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    }
    return renderInlineMarkdownText(part);
  }).join("");
}

function renderInlineMarkdownText(value) {
  let html = "";
  const linkPattern = /\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let lastIndex = 0;
  for (const match of value.matchAll(linkPattern)) {
    html += renderInlineDecorators(value.slice(lastIndex, match.index));
    html += renderMarkdownLink(match[1], match[2]);
    lastIndex = match.index + match[0].length;
  }
  html += renderInlineDecorators(value.slice(lastIndex));
  return html;
}

function renderMarkdownLink(label, href) {
  const safeHref = normalizeSafeLink(href);
  if (!safeHref) return renderInlineDecorators(label);
  const external = /^https?:/i.test(safeHref);
  const target = external ? ` target="_blank" rel="noopener noreferrer"` : "";
  return `<a href="${escapeHtml(safeHref)}"${target}>${renderInlineDecorators(label)}</a>`;
}

function normalizeSafeLink(href) {
  const url = String(href || "").trim();
  if (/^(https?:|mailto:|obsidian:)/i.test(url)) return url;
  if (/^[/.#][^\s]*$/.test(url)) return url;
  return "";
}

function renderInlineDecorators(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>")
    .replace(/_([^_\s][^_]*?)_/g, "<em>$1</em>");
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
      <span class="metric-label">Task-ignored paths</span>
    </div>
    <p class="index-meta">Last indexed: ${escapeHtml(lastRun)}</p>
    <p class="index-meta">Watcher: ${escapeHtml(watcher)}</p>
  `;
  renderTasksBadge(status.openTaskCount);
}

function renderTasksBadge(count = null) {
  const openCount = Number(count ?? state.indexStatus?.openTaskCount ?? state.dashboard?.taskSummary?.openCount ?? state.tasksTotal ?? 0);
  if (tasksNavBadge) {
    tasksNavBadge.hidden = !openCount;
    tasksNavBadge.textContent = openCount > 99 ? "99+" : String(openCount);
  }
  if (tasksCount) {
    const label = state.taskStatus === "open" ? "open" : state.taskStatus;
    tasksCount.textContent = `${numberFormat(state.tasksTotal)} ${label}`;
  }
}

function renderDashboard() {
  if (!state.dashboard) return;
  renderDashboardIdentity(state.dashboard.habits?.identity || null);
  renderPersonalSystemDashboard(state.dashboard.personalSystem || null);
  renderHabitDashboard(state.dashboard.habits || null);
  renderDeepWorkDashboard(state.dashboard.deepWork || null);
}

function renderDashboardIdentity(identity) {
  if (!dashboardIdentity) return;
  const text = String(identity?.text || "").trim();
  dashboardIdentity.hidden = !text;
  if (!text) {
    dashboardIdentity.innerHTML = "";
    return;
  }
  dashboardIdentity.innerHTML = `
    <div class="identity-card">
      <span>Identity</span>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function renderPersonalSystemDashboard(personalSystem) {
  if (!dashboardOverview) return;
  if (!personalSystem?.available) {
    dashboardOverview.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Checklist state not found.</p>
        <p>${escapeHtml(personalSystem?.message || "Create the personal checklist state note to enable cadence nudges.")}</p>
      </div>
      ${renderPersonalSystemLinks(personalSystem)}
    `;
    if (dashboardCadenceToggle) dashboardCadenceToggle.hidden = true;
    return;
  }

  const items = personalSystem.items || [];
  const visibleItems = state.dashboardShowAllCadence
    ? items
    : items.filter((item) => item.status !== "current");
  if (dashboardCadenceToggle) {
    dashboardCadenceToggle.hidden = items.every((item) => item.status !== "current");
    dashboardCadenceToggle.textContent = state.dashboardShowAllCadence ? "Show nudges" : "Show all";
    dashboardCadenceToggle.setAttribute("aria-expanded", String(state.dashboardShowAllCadence));
  }
  dashboardOverview.innerHTML = `
    <div class="cadence-summary">
      <div>
        <span>${numberFormat(personalSystem.attentionCount || 0)}</span>
        <p>Needs attention</p>
      </div>
      <div>
        <span>${numberFormat(personalSystem.currentCount || 0)}</span>
        <p>Current</p>
      </div>
    </div>
    <div class="cadence-list">
      ${visibleItems.length ? visibleItems.map(renderCadenceItem).join("") : `
        <div class="empty-state compact-empty">
          <p class="empty-title">All personal cadences are current.</p>
          <p>Nothing needs a nudge right now.</p>
        </div>
      `}
    </div>
    ${renderPersonalSystemLinks(personalSystem)}
  `;
}

function renderCadenceItem(item) {
  const status = item.status || "current";
  return `
    <article class="cadence-item cadence-${escapeHtml(status)}">
      <div>
        <div class="cadence-item-head">
          <strong>${escapeHtml(item.label || item.key || "Cadence")}</strong>
          <span>${escapeHtml(formatCadenceStatus(item))}</span>
        </div>
        <p>${escapeHtml(formatCadenceDetail(item))}</p>
      </div>
      <button class="secondary-button compact-button" type="button" data-cadence-prompt="${escapeHtml(item.actionPrompt || "")}">
        Run
      </button>
    </article>
  `;
}

function renderPersonalSystemLinks(personalSystem = {}) {
  const links = [
    ["Personal System", personalSystem.systemPath],
    ["Checklist State", personalSystem.statePath],
    ["Vision", "2.Areas/Personal/vision.md"]
  ].filter(([, path]) => path);
  return `
    <div class="dashboard-note-links" aria-label="Personal system notes">
      ${links.map(([label, path]) => `
        <button class="inline-note-link" type="button" data-open-note="${escapeHtml(path)}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderHabitDashboard(habits) {
  if (!dashboardHabits) return;
  if (!habits?.available) {
    dashboardHabits.innerHTML = `
      <div class="empty-state compact-empty">
        <p class="empty-title">No OKR habits found.</p>
        <p>${escapeHtml(habits?.message || "Mark habit KRs in the active personal OKR file.")}</p>
      </div>
    `;
    return;
  }

  const items = habits.items || [];
  dashboardHabits.innerHTML = `
    <div class="habit-summary">
      <div>
        <span>${numberFormat(items.filter((item) => item.todayDone).length)}</span>
        <p>Done today</p>
      </div>
      <div>
        <span>${numberFormat(habits.attentionCount || 0)}</span>
        <p>Needs attention</p>
      </div>
    </div>
    <div class="habit-list">
      ${items.length ? items.map(renderHabitItem).join("") : `
        <div class="empty-state compact-empty">
          <p class="empty-title">No tracked habits yet.</p>
          <p>Add <code>habit: true</code> to frequency KRs or use <code>type: habit</code>.</p>
        </div>
      `}
    </div>
    <div class="dashboard-note-links" aria-label="Habit source notes">
      ${habits.okrPath ? `<button class="inline-note-link" type="button" data-open-note="${escapeHtml(habits.okrPath)}">Open OKRs</button>` : ""}
      <span class="habit-range">${escapeHtml(formatHabitRange(habits))}</span>
    </div>
  `;
}

function renderHabitItem(item) {
  const status = item.status || "attention";
  const streak = Number(item.streak || 0);
  const streakUnit = item.streakUnit || (item.cadence === "weekly" ? "week" : "day");
  return `
    <article class="habit-item habit-${escapeHtml(status)}">
      <div class="habit-item-head">
        <div>
          <strong>${escapeHtml(item.description || item.activity || "Habit")}</strong>
          <span>${escapeHtml(item.statusLabel || status)}</span>
        </div>
        <span class="habit-streak">${numberFormat(streak)} ${escapeHtml(streakUnit)}${streak === 1 ? "" : "s"} streak</span>
      </div>
      ${renderHabitProgressBar(item)}
      <div class="habit-detail-row">
        <p>${escapeHtml(formatHabitDetail(item))}</p>
        ${renderHabitConsistency(item)}
      </div>
    </article>
  `;
}

function renderHabitProgressBar(item) {
  const current = Number(item.weekCount || 0);
  const target = Number(item.target || 0);
  const percent = target ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
  return `
    <div
      class="progress-bar habit-progress-bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${escapeHtml(String(percent))}"
      style="--progress-percent: ${escapeHtml(String(percent))}%"
    >
      <span></span>
    </div>
  `;
}

function renderHabitConsistency(item) {
  const periods = item.periods || {};
  const weeks = Array.isArray(periods.weeks) ? periods.weeks.slice(-12) : [];
  const days = Array.isArray(periods.currentWeekDays) ? periods.currentWeekDays : [];
  const cadence = item.cadence || "daily";
  return `
    <div class="habit-consistency habit-consistency-${escapeHtml(cadence)}" aria-label="${escapeHtml(item.description || item.activity || "Habit")} consistency">
      ${weeks.map(renderHabitWeekDot).join("")}
      ${days.length ? `
        <span class="habit-current-week" aria-label="Current week">
          ${days.map(renderHabitDayDot).join("")}
        </span>
      ` : ""}
    </div>
  `;
}

function renderHabitWeekDot(week) {
  const label = `${formatShortDate(week.start)}: ${numberFormat(week.count || 0)}/${numberFormat(week.target || 0)}`;
  return `
    <span
      class="habit-dot habit-dot-week habit-dot-${escapeHtml(week.status || "pending")} ${week.current ? "is-current" : ""}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
    ></span>
  `;
}

function renderHabitDayDot(day) {
  const label = `${formatShortDate(day.date)}: ${day.logged ? "logged" : (day.future ? "future" : "missed")}`;
  return `
    <span
      class="habit-dot habit-dot-day habit-dot-${escapeHtml(day.status || "future")} ${day.today ? "is-today" : ""}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
    ></span>
  `;
}

function formatHabitDetail(item) {
  const parts = [];
  if (item.activity) parts.push(`[activity:: ${item.activity}]`);
  return parts.join(" - ");
}

function formatHabitRange(habits = {}) {
  const quarter = habits.quarter || "Quarter";
  const range = habits.start && habits.end ? `${formatShortDate(habits.start)}-${formatShortDate(habits.end)}` : "";
  return [quarter, range].filter(Boolean).join(" - ");
}

function renderDeepWorkDashboard(deepWork) {
  if (!dashboardDeepWork) return;
  const sessions = deepWork?.sessions || [];
  const stats = deepWork?.stats || {};
  dashboardDeepWork.innerHTML = `
    <div class="deep-work-summary">
      <div>
        <span>${numberFormat(stats.last7DaysCount || 0)}</span>
        <p>This week</p>
      </div>
      <div>
        <span>${numberFormat(stats.activeCount || 0)}</span>
        <p>Active</p>
      </div>
      <div>
        <span>${numberFormat(stats.openTaskCount || 0)}</span>
        <p>Open tasks</p>
      </div>
    </div>
    <div class="deep-work-history-list">
      ${sessions.length ? sessions.map(renderDeepWorkHistoryItem).join("") : `
        <div class="empty-state compact-empty">
          <p class="empty-title">No Deep Work sessions yet.</p>
          <p>Start one from Chat when you want a focused thinking trail.</p>
        </div>
      `}
    </div>
  `;
}

function renderDeepWorkHistoryItem(session) {
  const status = session.status || "active";
  const updated = session.updated || session.created || "";
  const detail = [
    status === "completed" ? "Completed" : "Active",
    session.conversationTurns ? `${numberFormat(session.conversationTurns)} turn${session.conversationTurns === 1 ? "" : "s"}` : "",
    session.durationMinutes ? formatDurationMinutes(session.durationMinutes) : "",
    updated ? formatSessionUpdated(updated) : ""
  ].filter(Boolean).join(" · ");
  const taskText = Number(session.tasksOpen || 0) || Number(session.tasksDone || 0)
    ? `${numberFormat(session.tasksDone || 0)} done / ${numberFormat(session.tasksOpen || 0)} open`
    : "No tracked tasks";
  return `
    <article class="deep-work-history-item deep-work-history-${escapeHtml(status)}">
      <div>
        <div class="deep-work-history-head">
          <strong>${escapeHtml(session.goal || "Deep Work session")}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(detail || "No session metadata")}</p>
        <small>${escapeHtml(taskText)}${session.recapPresent ? " · recap saved" : ""}</small>
      </div>
      <div class="deep-work-history-actions">
        <button class="secondary-button compact-button" type="button" data-deep-work-resume="${escapeHtml(session.path)}" data-deep-work-goal="${escapeHtml(session.goal || "")}">Resume</button>
        <button class="secondary-button compact-button" type="button" data-deep-work-chat="${escapeHtml(session.path)}" data-deep-work-goal="${escapeHtml(session.goal || "")}">Chat</button>
        <button class="secondary-button compact-button" type="button" data-open-note="${escapeHtml(session.path)}">Open</button>
      </div>
    </article>
  `;
}

function formatDurationMinutes(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (total < 60) return `${Math.round(total)}m`;
  const hours = Math.floor(total / 60);
  const remainder = Math.round(total % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatDurationSeconds(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (total < 60) return `${Math.round(total)}s`;
  return formatDurationMinutes(total / 60);
}

async function resumeDeepWorkSession(sessionPath, goal) {
  const cleanGoal = String(goal || "").trim();
  if (!sessionPath || !cleanGoal) return;
  try {
    const data = await postJson("/api/deep-work/start", {
      goal: cleanGoal,
      sessionPath
    });
    state.deepWorkSessionPath = data.path || sessionPath;
    state.deepWorkGoal = data.goal || cleanGoal;
    state.deepWorkEnabled = true;
    window.localStorage.setItem(DEEP_WORK_GOAL_STORAGE_KEY, state.deepWorkGoal);
    window.localStorage.setItem(DEEP_WORK_ENABLED_STORAGE_KEY, "true");
    window.localStorage.setItem(DEEP_WORK_SESSION_STORAGE_KEY, state.deepWorkSessionPath);
    renderDeepWorkState();
    setActiveTab("chat");
    flashChatHelper("Deep Work session resumed.");
  } catch (error) {
    showToast(error.message, { duration: 2600 });
  }
}

function openDeepWorkSessionInChat(sessionPath, goal) {
  if (!sessionPath) return;
  startChatWithDraft(`Let's continue from this Deep Work session: ${goal || "focus session"}`, [{
    kind: "file",
    title: goal || "Deep Work session",
    name: goal || "Deep Work session",
    token: "deep-work-session",
    path: sessionPath
  }]);
}

function formatCadenceStatus(item) {
  if (item.status === "not-run") return "Not run";
  if (item.status === "overdue") return "Overdue";
  return "Current";
}

function formatCadenceDetail(item) {
  const cadence = item.cadence || "Cadence";
  if (!item.lastRun) return `${cadence} · no last-run date`;
  const days = Number(item.daysSinceRun);
  const age = Number.isFinite(days)
    ? `${days} day${days === 1 ? "" : "s"} ago`
    : "last run date unavailable";
  return `${cadence} · last run ${formatShortDate(item.lastRun)} (${age})`;
}

function renderDashboardLoading() {
  if (dashboardIdentity) {
    dashboardIdentity.hidden = true;
    dashboardIdentity.innerHTML = "";
  }
  if (dashboardOverview) dashboardOverview.innerHTML = `<p class="quiet-line">Loading cadence state...</p>`;
  if (dashboardHabits) dashboardHabits.innerHTML = `<p class="quiet-line">Loading habit state...</p>`;
  if (dashboardDeepWork) dashboardDeepWork.innerHTML = `<p class="quiet-line">Loading Deep Work history...</p>`;
}

function renderDashboardError(message) {
  if (dashboardIdentity) {
    dashboardIdentity.hidden = true;
    dashboardIdentity.innerHTML = "";
  }
  if (dashboardOverview) {
    dashboardOverview.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Dashboard unavailable.</p>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
  if (dashboardDeepWork) {
    dashboardDeepWork.innerHTML = `<p class="quiet-line">${escapeHtml(message)}</p>`;
  }
  if (dashboardHabits) {
    dashboardHabits.innerHTML = `<p class="quiet-line">${escapeHtml(message)}</p>`;
  }
}

async function loadPersonalSprint(view = state.personalSprintView) {
  if (!sprintContent) return;
  renderSprintLoading();
  try {
    const query = view ? `?view=${encodeURIComponent(view)}` : "";
    const previousPath = state.personalSprint?.sprint?.path || "";
    state.personalSprint = await getJson(`/api/personal-sprint${query}`);
    state.personalSprintView = state.personalSprint?.sprint?.view || "";
    if (previousPath && previousPath !== state.personalSprint?.sprint?.path) {
      state.sprintOpenObjectives = new Set();
      state.sprintExpandedKr = "";
    }
    initializeSprintOpenObjectives();
    renderPersonalSprint();
  } catch (error) {
    renderSprintError(error.message);
  }
}

function initializeSprintOpenObjectives() {
  const objectives = state.personalSprint?.okr?.objectives || [];
  if (state.sprintOpenObjectives.size) return;
  objectives
    .filter((objective) => objective.active)
    .forEach((objective) => state.sprintOpenObjectives.add(String(objective.id)));
}

function renderPersonalSprint() {
  if (!sprintContent || !state.personalSprint) return;
  const { sprint, okr, dailyFocus, focus } = state.personalSprint;
  renderSprintViewTabs(sprint);
  sprintContent.innerHTML = `
    ${renderDailyFocus(dailyFocus)}

    <section class="sprint-card active-sprint-card ${sprint.isStale ? "is-stale" : ""}">
      <div class="sprint-card-head">
        <div>
          <span class="sprint-kicker">Sprint</span>
          <h2>${escapeHtml(formatSprintRange(sprint.start, sprint.end))}</h2>
        </div>
        <div class="sprint-actions">
          <button class="note-link-button" type="button" data-sprint-chat>Open in chat</button>
          ${renderObsidianNoteLink(sprint.path, "Open sprint")}
        </div>
      </div>
      ${sprint.isStale ? `<p class="sprint-warning">${escapeHtml(sprint.staleMessage || "Sprint is stale.")}</p>` : ""}
      ${renderSprintIdentity(okr.identity)}
      <div class="sprint-priority">
        <span>Priority: KR ${escapeHtml(sprint.activeKr)}</span>
        <strong>${escapeHtml(sprint.activeKrDescription)}</strong>
        <small>${escapeHtml(sprint.activeKrType || "kr")} · tracked via [activity:: ${escapeHtml(sprint.activeKrActivity || "none")}]</small>
      </div>
      <div class="sprint-checkboxes" aria-label="Weekly sprint checkboxes">
        ${(sprint.weeklyCheckboxes || []).map(renderSprintCheckbox).join("")}
      </div>
      ${renderSprintProgress(sprint.activeProgress)}
      ${renderSprintSignals(sprint)}
    </section>

    ${renderSprintFocus(focus)}

    <section class="sprint-card okr-card">
      <div class="sprint-card-head">
        <div>
          <span class="sprint-kicker">${escapeHtml(okr.quarter || sprint.quarter || "OKRs")}</span>
          <h2>${escapeHtml(okr.title || "Personal OKRs")}</h2>
        </div>
        ${renderObsidianNoteLink(okr.path, "Open OKRs")}
      </div>
      <div class="okr-objectives">
        ${(okr.objectives || []).map(renderOkrObjective).join("")}
      </div>
    </section>
  `;
}

function renderSprintIdentity(identity) {
  const text = String(identity?.text || "").trim();
  if (!text) return "";
  return `
    <div class="sprint-identity">
      <span>Identity</span>
      <strong>${escapeHtml(text)}</strong>
    </div>
  `;
}

function renderDailyFocus(dailyFocus) {
  const hasFocus = Boolean(dailyFocus?.available && dailyFocus.text);
  return `
    <section class="sprint-card daily-focus-card">
      <div class="sprint-card-head">
        <div>
          <span class="sprint-kicker">Today's focus</span>
          <h2>${hasFocus ? escapeHtml(dailyFocus.text) : "No highlight set"}</h2>
        </div>
        <div class="sprint-actions">
          ${hasFocus ? `<button class="note-link-button" type="button" data-daily-focus-chat>Open in chat</button>` : ""}
          <button class="note-link-button" type="button" data-daily-focus-edit>${hasFocus ? "Edit" : "Set focus"}</button>
          ${hasFocus ? `<button class="note-link-button subtle-note-button" type="button" data-daily-focus-clear>Clear</button>` : ""}
          ${renderObsidianNoteLink(dailyFocus?.path || state.personalSprint?.sprint?.path || "", "Open sprint")}
        </div>
      </div>
      ${hasFocus ? `
        <div class="sprint-priority daily-focus-priority">
          <span>${escapeHtml(dailyFocus.date || "today")}${dailyFocus.source ? ` - ${escapeHtml(dailyFocus.source)}` : ""}</span>
          <strong>${escapeHtml(dailyFocus.text)}</strong>
        </div>
      ` : `<p class="quiet-line">Set the one thing that should get your best attention today.</p>`}
    </section>
  `;
}

function renderSprintFocus(focus) {
  const hasFocus = Boolean(focus?.available && focus.title);
  if (!hasFocus) return "";
  return `
    <section class="sprint-card focus-card">
      <div class="sprint-card-head">
        <div>
          <span class="sprint-kicker">Active idea</span>
          <h2>${hasFocus ? escapeHtml(focus.title) : "No active idea"}</h2>
        </div>
        <div class="sprint-actions">
          ${hasFocus ? `<button class="note-link-button" type="button" data-focus-chat>Open in chat</button>` : ""}
          ${hasFocus && focus.ideaPath ? renderObsidianNoteLink(focus.ideaPath, "Open idea") : ""}
          ${renderObsidianNoteLink(focus?.ledgerPath || "", "Open ledger")}
        </div>
      </div>
      <div class="sprint-priority focus-priority">
        <span>Active idea slot</span>
        <strong>${escapeHtml(focus.doneLooksLike || "Define the finish line in the idea ledger.")}</strong>
        ${focus.started ? `<small>Started ${escapeHtml(focus.started)}</small>` : ""}
      </div>
    </section>
  `;
}

function renderSprintSignals(sprint) {
  const signals = [];
  if (sprint.view === "last" && sprint.review) {
    if (sprint.review.uncheckedWeekCount) signals.push(`${numberFormat(sprint.review.uncheckedWeekCount)} unchecked week${sprint.review.uncheckedWeekCount === 1 ? "" : "s"}`);
    if (sprint.review.missedActivityWeekCount) signals.push(`${numberFormat(sprint.review.missedActivityWeekCount)} missed activity target${sprint.review.missedActivityWeekCount === 1 ? "" : "s"}`);
    if (sprint.review.incompleteActiveKr) signals.push(`Active KR still ${sprint.review.activeKrStatus || "incomplete"}`);
  }
  if (sprint.view === "next" && sprint.preview) {
    const starts = sprint.preview.startsInDays;
    if (starts !== null && starts !== undefined) {
      signals.push(starts > 0 ? `Starts in ${numberFormat(starts)} day${starts === 1 ? "" : "s"}` : "Starts today");
    }
    if (sprint.preview.plannedWeekCount) signals.push(`${numberFormat(sprint.preview.plannedWeekCount)} planned week${sprint.preview.plannedWeekCount === 1 ? "" : "s"}`);
  }
  if (!signals.length) return "";
  return `
    <div class="sprint-signals" aria-label="Sprint signals">
      ${signals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}
    </div>
  `;
}

function renderSprintProgress(progress = {}) {
  return `
    <div class="sprint-progress-block" aria-label="Active sprint progress">
      <div class="progress-copy">
        <span>${escapeHtml(progress.label || "No progress yet")}</span>
        <strong>${numberFormat(progress.percent || 0)}%</strong>
      </div>
      ${renderProgressBar(progress, "sprint-progress-bar")}
    </div>
  `;
}

function renderSprintViewTabs(sprint) {
  if (!sprintViewToggle) return;
  const views = sprint.availableViews || [];
  sprintViewToggle.hidden = views.length <= 1;
  sprintViewToggle.innerHTML = views.length <= 1 ? "" : `
    ${views.map((item) => `
        <button
          type="button"
          role="tab"
          class="${item.view === sprint.view ? "is-active" : ""}"
          data-sprint-view="${escapeHtml(item.view)}"
          aria-selected="${item.view === sprint.view}"
          title="${escapeHtml(formatSprintRange(item.start, item.end))}"
        >
          ${escapeHtml(item.label)}
        </button>
      `).join("")}
  `;
}

function renderSprintCheckbox(item) {
  return `
    <label class="sprint-checkbox-row ${item.isCurrentWeek ? "is-current-week" : ""}">
      <input type="checkbox" data-sprint-week="${escapeHtml(item.week)}" ${item.done ? "checked" : ""} />
      <span>${escapeHtml(item.label)}</span>
      ${item.isCurrentWeek ? `<strong>Current week</strong>` : ""}
    </label>
  `;
}

function renderOkrObjective(objective) {
  const isOpen = state.sprintOpenObjectives.has(String(objective.id));
  return `
    <article class="okr-objective ${objective.active ? "is-active" : ""}">
      <button class="okr-objective-head" type="button" data-okr-objective="${escapeHtml(objective.id)}" aria-expanded="${isOpen}">
        <span>${isOpen ? "▼" : "▶"}</span>
        <strong>Obj ${escapeHtml(objective.id)}: ${escapeHtml(objective.title)}</strong>
      </button>
      ${isOpen ? `<div class="okr-kr-list">${(objective.keyResults || []).map(renderOkrKrRow).join("")}</div>` : ""}
    </article>
  `;
}

function renderOkrKrRow(kr) {
  const expanded = state.sprintExpandedKr === kr.id;
  const okrPath = state.personalSprint?.okr?.path || "";
  return `
    <article class="okr-kr-row ${kr.isActive ? "is-active" : ""}">
      <button class="okr-kr-main" type="button" data-okr-kr="${escapeHtml(kr.id)}" aria-expanded="${expanded}">
        <span class="okr-kr-id">KR ${escapeHtml(kr.id)}</span>
        <span class="okr-kr-description">${escapeHtml(kr.description)}</span>
        ${renderKrProgress(kr)}
      </button>
      ${expanded ? `
        <div class="okr-kr-detail">
          <p>${escapeHtml(kr.description)}</p>
          <span>${escapeHtml(kr.type || "kr")}${kr.activity ? ` · [activity:: ${escapeHtml(kr.activity)}]` : ""}${kr.domain ? ` · ${escapeHtml(kr.domain)}` : ""}</span>
          <div class="okr-kr-actions">
            <button class="note-link-button" type="button" data-kr-chat="${escapeHtml(kr.id)}">Open in chat</button>
            ${renderObsidianNoteLink(okrPath, "Open OKRs")}
          </div>
        </div>
      ` : ""}
    </article>
  `;
}

function renderKrProgress(kr) {
  const progress = kr.progress || {};
  return `
    <span class="okr-progress">
      <span>${escapeHtml(progress.label || "No progress")}</span>
      ${renderProgressBar(progress, "okr-progress-bar")}
    </span>
  `;
}

function renderProgressBar(progress = {}, className = "") {
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  return `
    <span
      class="progress-bar ${escapeHtml(className)}"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${escapeHtml(String(Math.round(percent)))}"
      style="--progress-percent: ${escapeHtml(String(percent))}%"
    >
      <span></span>
    </span>
  `;
}

function handleSprintClick(event) {
  const sprintViewButton = event.target.closest("[data-sprint-view]");
  if (sprintViewButton) {
    event.preventDefault();
    const nextView = sprintViewButton.dataset.sprintView || "";
    if (nextView && nextView !== state.personalSprintView) {
      state.personalSprintView = nextView;
      loadPersonalSprint(nextView);
    }
    return;
  }

  const sprintChatButton = event.target.closest("[data-sprint-chat]");
  if (sprintChatButton) {
    event.preventDefault();
    openSprintInChat();
    return;
  }

  const focusChatButton = event.target.closest("[data-focus-chat]");
  if (focusChatButton) {
    event.preventDefault();
    openFocusInChat();
    return;
  }

  const dailyFocusChatButton = event.target.closest("[data-daily-focus-chat]");
  if (dailyFocusChatButton) {
    event.preventDefault();
    openDailyFocusInChat();
    return;
  }

  const dailyFocusEditButton = event.target.closest("[data-daily-focus-edit]");
  if (dailyFocusEditButton) {
    event.preventDefault();
    promptDailyFocus();
    return;
  }

  const dailyFocusClearButton = event.target.closest("[data-daily-focus-clear]");
  if (dailyFocusClearButton) {
    event.preventDefault();
    setDailyFocus("");
    return;
  }

  const krChatButton = event.target.closest("[data-kr-chat]");
  if (krChatButton) {
    event.preventDefault();
    openKrInChat(krChatButton.dataset.krChat || "");
    return;
  }

  const noteButton = event.target.closest("[data-open-note]");
  if (noteButton) {
    event.preventDefault();
    openObsidianNote(noteButton.dataset.openNote || "");
    return;
  }

  const objectiveButton = event.target.closest("[data-okr-objective]");
  if (objectiveButton) {
    const id = String(objectiveButton.dataset.okrObjective || "");
    if (state.sprintOpenObjectives.has(id)) {
      state.sprintOpenObjectives.delete(id);
    } else {
      state.sprintOpenObjectives.add(id);
    }
    renderPersonalSprint();
    return;
  }

  const krButton = event.target.closest("[data-okr-kr]");
  if (krButton) {
    const id = krButton.dataset.okrKr || "";
    state.sprintExpandedKr = state.sprintExpandedKr === id ? "" : id;
    renderPersonalSprint();
  }
}

function openSprintInChat() {
  const sprint = state.personalSprint?.sprint;
  if (!sprint) return;
  const sprintLabel = getSprintViewLabel(sprint.view).toLowerCase();
  const message = [
    `Let's work through my ${sprintLabel} personal sprint.`,
    `Sprint: ${formatSprintRange(sprint.start, sprint.end)}`,
    `Priority KR ${sprint.activeKr}: ${sprint.activeKrDescription}`,
    `Activity logs this sprint: ${sprint.activeActivityCount}`
  ].join("\n");
  startChatWithDraft(message, [{
    kind: "file",
    title: "Sprint Plan",
    name: "Sprint Plan",
    token: "sprint-plan",
    path: sprint.path
  }]);
}

function promptDailyFocus() {
  const current = state.personalSprint?.dailyFocus?.text || "";
  const next = window.prompt("Today's focus", current);
  if (next === null) return;
  setDailyFocus(next);
}

async function setDailyFocus(text, { source = "webapp" } = {}) {
  const trimmed = String(text || "").trim();
  try {
    showToast(trimmed ? "Saving focus..." : "Clearing focus...");
    state.personalSprint = await postJson("/api/personal-sprint/daily-focus", {
      text: trimmed,
      source,
      view: state.personalSprintView
    });
    state.personalSprintView = state.personalSprint?.sprint?.view || state.personalSprintView;
    renderPersonalSprint();
    showToast(trimmed ? "Today's focus saved." : "Today's focus cleared.");
  } catch (error) {
    showToast(error.message, { duration: 3200 });
  }
}

function openDailyFocusInChat() {
  const dailyFocus = state.personalSprint?.dailyFocus;
  const sprint = state.personalSprint?.sprint;
  if (!dailyFocus?.available) return;
  const message = [
    "Let's work through today's focus.",
    `Focus: ${dailyFocus.text}`,
    sprint ? `Sprint: ${formatSprintRange(sprint.start, sprint.end)}` : ""
  ].filter(Boolean).join("\n");
  startChatWithDraft(message, [
    sprint?.path ? {
      kind: "file",
      title: "Sprint Plan",
      name: "Sprint Plan",
      token: "sprint-plan",
      path: sprint.path
    } : null
  ].filter(Boolean));
}

async function openSprintCategorizeSession() {
  if (sprintCategorizeButton) sprintCategorizeButton.disabled = true;
  try {
    showToast("Opening categorization chat...");
    await startChatWithPrompt("Categorize fleeting note with domain and activity for pending ones. Identify if any sources are needed", []);
  } finally {
    if (sprintCategorizeButton) sprintCategorizeButton.disabled = false;
  }
}

function openFocusInChat() {
  const focus = state.personalSprint?.focus;
  if (!focus?.available) return;
  const message = [
    `Let's focus on my active idea: ${focus.title}.`,
    focus.doneLooksLike ? `Done looks like: ${focus.doneLooksLike}` : "",
    focus.started ? `Started: ${focus.started}` : ""
  ].filter(Boolean).join("\n");
  startChatWithDraft(message, [
    focus.ideaPath ? {
      kind: "file",
      title: focus.title,
      name: focus.title,
      token: slugifyUiToken(focus.title || "active-focus"),
      path: focus.ideaPath
    } : null,
    focus.ledgerPath ? {
      kind: "file",
      title: "Idea Ledger",
      name: "Idea Ledger",
      token: "idea-ledger",
      path: focus.ledgerPath
    } : null
  ].filter(Boolean));
}

function getSprintViewLabel(view) {
  const item = (state.personalSprint?.sprint?.availableViews || []).find((candidate) => candidate.view === view);
  return item?.label || "Current";
}

function openKrInChat(krId) {
  const sprint = state.personalSprint?.sprint;
  const okr = state.personalSprint?.okr;
  const kr = (okr?.objectives || []).flatMap((objective) => objective.keyResults || []).find((item) => item.id === krId);
  if (!kr || !okr) return;
  const message = [
    `Let's work on KR ${kr.id}.`,
    kr.description,
    `Current progress: ${kr.progress?.label || "No progress label"}`,
    kr.activity ? `Activity tag: [activity:: ${kr.activity}]` : ""
  ].filter(Boolean).join("\n");
  startChatWithDraft(message, [
    {
      kind: "file",
      title: "Personal OKRs",
      name: "Personal OKRs",
      token: "personal-okrs",
      path: okr.path
    },
    sprint?.path ? {
      kind: "file",
      title: "Sprint Plan",
      name: "Sprint Plan",
      token: "sprint-plan",
      path: sprint.path
    } : null
  ].filter(Boolean));
}

async function handleSprintChange(event) {
  const checkbox = event.target.closest("[data-sprint-week]");
  if (!checkbox) return;
  checkbox.disabled = true;
  try {
    state.personalSprint = await postJson("/api/personal-sprint/checkbox", {
      week: checkbox.dataset.sprintWeek,
      done: checkbox.checked,
      view: state.personalSprintView
    });
    state.personalSprintView = state.personalSprint?.sprint?.view || state.personalSprintView;
    renderPersonalSprint();
    flashHelper("Sprint checkbox updated.");
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
    flashHelper(error.message);
  }
}

function renderSprintLoading() {
  if (!sprintContent) return;
  if (sprintViewToggle) {
    sprintViewToggle.hidden = true;
    sprintViewToggle.innerHTML = "";
  }
  sprintContent.innerHTML = `<div class="empty-state"><p class="empty-title">Loading sprint...</p></div>`;
}

function renderSprintError(message) {
  if (!sprintContent) return;
  if (sprintViewToggle) {
    sprintViewToggle.hidden = true;
    sprintViewToggle.innerHTML = "";
  }
  sprintContent.innerHTML = `
    <div class="empty-state">
      <p class="empty-title">Sprint unavailable.</p>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function formatSprintRange(start, end) {
  const left = formatShortDate(start);
  const right = formatShortDate(end);
  return left && right ? `${left} – ${right}` : "No active window";
}

function formatShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
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
  if (!tasksList) return;
  renderTasksBadge();
  renderTaskFilterState();
  tasksList.classList.toggle("is-matrix", state.taskView === "matrix");
  tasksList.classList.toggle("is-list", state.taskView !== "matrix");

  if (!state.tasks.length) {
    tasksList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">No open tasks found.</p>
        <p>${state.taskStatus === "done" ? "Completed tasks will appear here." : "Rebuild the index after adding Markdown tasks."}</p>
      </div>
    `;
    return;
  }

  tasksList.innerHTML = state.taskView === "matrix"
    ? renderTaskMatrix()
    : state.tasks.map(renderTaskRow).join("");
}

function renderTaskMatrix() {
  const groups = [
    { key: "do-now", title: "Do now", description: "Important and urgent" },
    { key: "schedule", title: "Schedule", description: "Important, not urgent" },
    { key: "quick", title: "Quick", description: "Urgent, not important" },
    { key: "someday", title: "Someday", description: "Not urgent or important" },
    { key: "triage", title: "Needs triage", description: "Missing importance or urgency" }
  ];
  return `
    <div class="task-matrix" aria-label="Eisenhower task matrix">
      ${groups.map((group) => {
        const tasks = state.tasks
          .filter((task) => getTaskMatrixGroup(task) === group.key)
          .sort((a, b) => sortMatrixTasks(a, b, group.key));
        return `
          <section class="task-matrix-column task-matrix-${escapeHtml(group.key)}">
            <div class="task-matrix-head">
              <div>
                <h2>${escapeHtml(group.title)}</h2>
                <p>${escapeHtml(group.description)}</p>
              </div>
              <span>${numberFormat(tasks.length)}</span>
            </div>
            <div class="task-matrix-list">
              ${tasks.length ? tasks.map((task) => renderTaskRow(task, { showQuadrant: false })).join("") : `<p class="quiet-line">No tasks here.</p>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function getTaskMatrixGroup(task) {
  const dueState = getTaskDueState(task?.due);
  if (dueState === "overdue" || dueState === "today") return "do-now";
  if (task?.effort === "5m") return "do-now";
  if (dueState === "future") return "schedule";
  return task?.quadrant || "triage";
}

function sortMatrixTasks(a, b, groupKey) {
  if (groupKey !== "do-now" && groupKey !== "schedule") return 0;

  const aDue = normalizeDueDate(a?.due);
  const bDue = normalizeDueDate(b?.due);
  if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
  if (aDue && !bDue) return -1;
  if (!aDue && bDue) return 1;
  return 0;
}

function renderTaskRow(task, options = {}) {
  return `
    <article class="task-row" data-task-id="${escapeHtml(task.id)}" title="Double-click to edit">
      ${renderTaskSourceInfo(task)}
      ${renderTaskCheckbox(task)}
      <div class="task-main">
        <p>${escapeHtml(task.text)}</p>
        <div class="task-meta">
          ${renderTaskBadges(task, options)}
          ${task.project ? `<span>${escapeHtml(task.project)}</span>` : ""}
        </div>
      </div>
    </article>
  `;
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

function renderTaskBadges(task, options = {}) {
  const badges = [];
  const taskId = task.id || null;
  const makeEditable = (badge) => taskId ? {
    ...badge,
    className: `${badge.className} task-badge-button`,
    taskId
  } : badge;

  if (shouldShowQuadrantBadge(task, options)) {
    badges.push(makeEditable({ label: formatQuadrant(task.quadrant), className: `task-badge-${task.quadrant}` }));
  }
  if (task.important === true) badges.push(makeEditable({ label: "important", className: "task-badge-important" }));
  if (task.urgent === true) badges.push(makeEditable({ label: "urgent", className: "task-badge-urgent" }));
  if (task.priority) badges.push(makeEditable({ label: task.priority, className: `priority-${String(task.priority).toLowerCase()}` }));
  if (task.effort === "5m") badges.push(makeEditable({ label: "5 min", className: "task-badge-effort" }));
  if (task.due) badges.push(makeEditable({ label: formatDueBadgeLabel(task.due), className: `task-badge-due task-badge-due-${getTaskDueState(task.due)}` }));
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

function formatDueBadgeLabel(due) {
  const dueState = getTaskDueState(due);
  if (dueState === "today") return "due today";
  if (dueState === "overdue") return `overdue ${due}`;
  return `due ${due}`;
}

function getTaskDueState(due) {
  const normalizedDue = normalizeDueDate(due);
  if (!normalizedDue) return "none";
  const today = getLocalDateSlug();
  if (normalizedDue < today) return "overdue";
  if (normalizedDue === today) return "today";
  return "future";
}

function normalizeDueDate(due) {
  const value = String(due || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function shouldShowQuadrantBadge(task, options = {}) {
  if (options.showQuadrant === false) return false;
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
  taskViewButtons.forEach((button) => {
    const isActive = button.dataset.taskView === state.taskView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (taskFocusFilter) taskFocusFilter.value = state.taskFocus;
  if (taskScopeFilter) taskScopeFilter.value = state.taskScope;
  if (taskSourceFilter) taskSourceFilter.value = state.taskSource;
  if (taskFocusFilter) {
    taskFocusFilter.disabled = state.taskView === "matrix";
    taskFocusFilter.closest(".filter-field")?.classList.toggle("is-disabled", state.taskView === "matrix");
  }
  const activeFilterCount = getActiveTaskFilterCount();
  taskFilterClearButton?.toggleAttribute("disabled", !activeFilterCount);
  if (taskFilterCount) {
    taskFilterCount.hidden = activeFilterCount === 0;
    taskFilterCount.textContent = activeFilterCount ? String(activeFilterCount) : "";
  }
  if (taskFilterToggle) {
    taskFilterToggle.classList.toggle("has-active-filters", activeFilterCount > 0);
    taskFilterToggle.setAttribute("aria-expanded", String(!(taskFilterPanel?.hidden ?? true)));
  }
}

function readTaskFiltersFromControls() {
  state.taskStatus = "open";
  if (taskFocusFilter) state.taskFocus = taskFocusFilter.value || "all";
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
  return getActiveTaskFilterCount() > 0;
}

function getActiveTaskFilterCount() {
  let count = 0;
  if (state.taskView === "list" && state.taskFocus !== "all") count += 1;
  if (state.taskScope !== "all") count += 1;
  if (state.taskSource !== "all") count += 1;
  return count;
}

function setTaskFiltersOpen(isOpen) {
  if (!taskFilterPanel || !taskFilterToggle) return;
  taskFilterPanel.hidden = !isOpen;
  taskFilterToggle.setAttribute("aria-expanded", String(isOpen));
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
  if (!helperLine) return;
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

function showToast(message, { duration = 1800 } = {}) {
  if (!actionToast || !message) return;
  window.clearTimeout(state.toastTimer);
  actionToast.hidden = false;
  actionToast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  state.toastTimer = window.setTimeout(hideToast, duration);
}

function hideToast() {
  if (!actionToast) return;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = null;
  actionToast.hidden = true;
  actionToast.innerHTML = "";
}

async function getJson(url) {
  const headers = state.authSecret ? { "X-Second-Brain-Secret": state.authSecret } : {};
  const response = await fetch(url, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function protectedGetJson(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: getWriteHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    handleAuthError(response.status);
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: getWriteHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    handleAuthError(response.status);
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function handleAuthError(status) {
  if (status !== 401) return;
  if (state.config?.githubAvailable) {
    window.location.href = "/auth/login";
  } else if (state.config?.authRequired) {
    openAuthSheet();
  }
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
  if (watcher.status === "error") return `error: ${compactStatusText(watcher.lastError || "unknown", 120)}`;
  return watcher.status || "unavailable";
}

function compactStatusText(value, maxLength = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
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
