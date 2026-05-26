import http from "node:http";
import { promises as fs, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { SECOND_BRAIN_CAPABILITIES } from "./src/capabilities/manifest.js";
import {
  createMcpHttpServer,
  isLoopbackHost,
  readMcpAuditEntries,
  validateMcpConfig
} from "./src/mcp/httpServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_STARTED_AT = new Date().toISOString();

await loadDotEnv(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || "3030");
const VAULT_PATH = process.env.VAULT_PATH;
const IS_ICLOUD_VAULT = /\/(?:Mobile Documents|CloudDocs)\//.test(String(VAULT_PATH || ""));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, ".data");
const DB_PATH = path.join(DATA_DIR, "index.sqlite");
const SQLITE_BIN = process.env.SQLITE_BIN || "/usr/bin/sqlite3";
const WATCH_DEBOUNCE_MS = Number(process.env.WATCH_DEBOUNCE_MS || "1200");
const ICLOUD_WATCH_DEBOUNCE_MS = Number(process.env.ICLOUD_WATCH_DEBOUNCE_MS || "15000");
const ICLOUD_STARTUP_INDEX_DELAY_MS = Number(process.env.ICLOUD_STARTUP_INDEX_DELAY_MS || "30000");
const ICLOUD_READ_RETRY_COUNT = Number(process.env.ICLOUD_READ_RETRY_COUNT || "3");
const MAX_INDEX_READ_ERROR_LOGS = Number(process.env.MAX_INDEX_READ_ERROR_LOGS || "10");
const AUTO_INDEX_ON_START = process.env.AUTO_INDEX_ON_START !== "false";
const VAULT_WATCH_ENABLED = process.env.VAULT_WATCH_ENABLED
  ? process.env.VAULT_WATCH_ENABLED !== "false"
  : !IS_ICLOUD_VAULT;
const NIGHTLY_INDEX_ENABLED = process.env.NIGHTLY_INDEX_ENABLED
  ? process.env.NIGHTLY_INDEX_ENABLED !== "false"
  : IS_ICLOUD_VAULT;
const NIGHTLY_INDEX_HOUR = clampNumber(process.env.NIGHTLY_INDEX_HOUR, 3, 0, 23);
const NIGHTLY_INDEX_MINUTE = clampNumber(process.env.NIGHTLY_INDEX_MINUTE, 15, 0, 59);
const APP_SECRET = process.env.APP_SECRET || "";
const MCP_ENABLED = process.env.MCP_ENABLED === "true";
const MCP_HOST = process.env.MCP_HOST || "127.0.0.1";
const MCP_PORT = Number(process.env.MCP_PORT || "3031");
const MCP_TOKEN = process.env.MCP_TOKEN || "";
const MCP_ALLOWED_TOOLS = parseListEnv(process.env.MCP_ALLOWED_TOOLS);
const MCP_CLIENT_TOOL_ALLOWLISTS = parseMcpClientToolAllowlists(process.env.MCP_CLIENT_TOOL_ALLOWLISTS);
const MCP_AUDIT_LOG = process.env.MCP_AUDIT_LOG ? path.resolve(__dirname, process.env.MCP_AUDIT_LOG) : path.join(DATA_DIR, "mcp-audit.jsonl");
const MCP_ALLOWED_ORIGINS = parseListEnv(process.env.MCP_ALLOWED_ORIGINS);
const MCP_RATE_LIMIT_WINDOW_MS = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS || "60000");
const MCP_RATE_LIMIT_MAX = Number(process.env.MCP_RATE_LIMIT_MAX || "60");
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_MAX_AGE = Math.max(300, Number(process.env.SESSION_MAX_AGE || "86400"));
const GITHUB_ALLOWED_LOGINS = parseListEnv(process.env.GITHUB_ALLOWED_LOGINS);
const GITHUB_AUTH_HOSTS = parseListEnv(process.env.GITHUB_AUTH_HOSTS);
const APP_SECRET_AUTH_HOSTS = parseListEnv(process.env.APP_SECRET_AUTH_HOSTS);
const GITHUB_CONFIG_PRESENT = Boolean(GITHUB_CLIENT_ID || GITHUB_CLIENT_SECRET || SESSION_SECRET || GITHUB_ALLOWED_LOGINS.length);
const GITHUB_ENABLED = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && SESSION_SECRET && GITHUB_ALLOWED_LOGINS.length);
const CHAT_PROVIDER = (process.env.CHAT_PROVIDER || "hermes").toLowerCase();
const HERMES_BASE_URL = (process.env.HERMES_BASE_URL || "http://127.0.0.1:8642/v1").replace(/\/+$/, "");
const HERMES_API_KEY = process.env.HERMES_API_KEY || "";
const HERMES_AUTO_START = process.env.HERMES_AUTO_START !== "false";
const HERMES_HOST = process.env.HERMES_HOST || "127.0.0.1";
const HERMES_PORT = Number(process.env.HERMES_PORT || "8642");
const HERMES_BIN = process.env.HERMES_BIN || "";
const HERMES_REGULAR_MODEL = process.env.HERMES_REGULAR_MODEL || process.env.HERMES_MODEL || "deepseek-v4-flash";
const HERMES_THINKING_MODEL = process.env.HERMES_THINKING_MODEL || "deepseek-v4-pro";
const HERMES_REQUEST_TIMEOUT_MS = Math.max(10000, Number(process.env.HERMES_REQUEST_TIMEOUT_MS || "120000"));
const HERMES_CHAT_TIMEOUT_MS = Math.max(30000, Number(process.env.HERMES_CHAT_TIMEOUT_MS || HERMES_REQUEST_TIMEOUT_MS));
const HERMES_CHAT_SLOW_LOG_MS = Math.max(5000, Number(process.env.HERMES_CHAT_SLOW_LOG_MS || "30000"));
const CHAT_SELECTED_CONTEXT_ENTRY_LIMIT = Math.max(4000, Number(process.env.CHAT_SELECTED_CONTEXT_ENTRY_LIMIT || "16000"));
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_REGULAR_MODEL = process.env.DEEPSEEK_REGULAR_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const DEEPSEEK_THINKING_MODEL = process.env.DEEPSEEK_THINKING_MODEL || "deepseek-v4-pro";
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_TRAINING_OPT_OUT = process.env.DEEPSEEK_TRAINING_OPT_OUT !== "false";
const DEEPSEEK_DEFAULT_THINKING = process.env.DEEPSEEK_THINKING === "enabled" ? "enabled" : "disabled";
const DEEPSEEK_REASONING_EFFORT = process.env.DEEPSEEK_REASONING_EFFORT === "max" ? "max" : "high";
const TEST_AI_JSON = process.env.TEST_AI_JSON || "";
const TEST_GITHUB_USER_JSON = process.env.TEST_GITHUB_USER_JSON || "";
const CHAT_CONTEXT_LIMIT = Math.min(Number(process.env.CHAT_CONTEXT_LIMIT || "6"), 12);
const CHAT_HISTORY_LIMIT = Math.min(Number(process.env.CHAT_HISTORY_LIMIT || "8"), 16);
const CHAT_SESSIONS_DIR = normalizeVaultRelativeDir(process.env.CHAT_SESSIONS_DIR || "3.Resources/gpt/sessions");
const DEEP_WORK_SESSIONS_DIR = normalizeVaultRelativeDir(process.env.DEEP_WORK_SESSIONS_DIR || `${CHAT_SESSIONS_DIR}/deep-work`);
const CHAT_NOTES_DIR = normalizeVaultRelativeDir(process.env.CHAT_NOTES_DIR || "3.Resources/gpt/notes");
const FLEETING_REVIEWS_DIR = normalizeVaultRelativeDir(process.env.FLEETING_REVIEWS_DIR || "3.Resources/gpt/reviews/fleeting");
const PERSONAL_OKR_ROOT = normalizeVaultRelativeDir(process.env.PERSONAL_OKR_ROOT || "2.Areas/Personal/OKRs");
const PERSONAL_IDEA_LEDGER_PATH = normalizeVaultRelativeMarkdownPath(process.env.PERSONAL_IDEA_LEDGER_PATH || "2.Areas/Personal/Ideas/idea-ledger.md");
const PERSONAL_SYSTEM_PATH = normalizeVaultRelativeMarkdownPath(process.env.PERSONAL_SYSTEM_PATH || "2.Areas/Personal/System/Personal System.md");
const PERSONAL_CHECKLIST_STATE_PATH = normalizeVaultRelativeMarkdownPath(process.env.PERSONAL_CHECKLIST_STATE_PATH || "2.Areas/Personal/System/checklist-state.md");
const PERSONAL_SPRINT_STATE_PATH = process.env.PERSONAL_SPRINT_STATE_PATH
  ? normalizeVaultRelativeMarkdownPath(process.env.PERSONAL_SPRINT_STATE_PATH)
  : "";
const INDEX_IGNORE_FILE = process.env.INDEX_IGNORE_FILE
  ? path.resolve(__dirname, process.env.INDEX_IGNORE_FILE)
  : path.join(__dirname, ".second-brain-ignore");
const CAPTURE_CATEGORIES = new Set(["log", "thought", "idea", "todo", "reflection"]);
const SKIPPED_DIRS = new Set([".obsidian", ".git", ".trash", ".agents", "node_modules", ".data"]);
const SKILL_ROOT = ".agents/skills";
const SKIPPED_PATH_PARTS = new Set(["attachments", "credentials"]);
const SENSITIVE_PATH_PATTERN = /(?:password|passwd|secret|token|credential|api[-_ ]?key|private[-_ ]?key)/i;
const CAPABILITY_DEFINITIONS = new Map(SECOND_BRAIN_CAPABILITIES.map((capability) => [capability.name, capability]));
const DEFAULT_MCP_ALLOWED_TOOLS = [
  "capture.append",
  "capture.recent",
  "tasks.create",
  "tasks.list",
  "sprint.current",
  "sprint.set_daily_focus",
  "dashboard.summary"
];

const MCP_ALLOWED_TOOL_SET = new Set(MCP_ALLOWED_TOOLS.length ? MCP_ALLOWED_TOOLS : DEFAULT_MCP_ALLOWED_TOOLS);

if (!VAULT_PATH) {
  console.error("Missing VAULT_PATH. Create .env from .env.example and set your Obsidian vault path.");
  process.exit(1);
}

if (GITHUB_CONFIG_PRESENT && !GITHUB_ENABLED) {
  console.error("GitHub OAuth requires GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, and GITHUB_ALLOWED_LOGINS.");
  process.exit(1);
}

try {
  validateMcpConfig({ enabled: MCP_ENABLED, host: MCP_HOST, token: MCP_TOKEN, appSecret: APP_SECRET });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const watcherState = {
  enabled: false,
  recursive: false,
  status: "stopped",
  debounceMs: WATCH_DEBOUNCE_MS,
  pending: false,
  queued: false,
  eventCount: 0,
  lastEventAt: null,
  lastEventPath: null,
  lastRunAt: null,
  lastAttemptAt: null,
  nightlyEnabled: NIGHTLY_INDEX_ENABLED,
  nextNightlyRunAt: null,
  lastReason: null,
  lastError: null
};
let vaultWatcher = null;
let indexTimer = null;
let nightlyIndexTimer = null;
let activeIndexPromise = null;
let indexIgnoreRules = [];

await loadIndexIgnoreRules();
await ensureIndexSchema();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/api/auth/me" && req.method === "GET") {
      return sendJson(res, 200, await getAuthUser(req));
    }

    if (url.pathname === "/api/auth/check" && req.method === "POST") {
      requireWriteAuth(req);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/auth/login" && req.method === "GET") {
      if (!isGitHubAuthRequest(req)) return sendJson(res, 404, { error: "GitHub login is not enabled for this host." });
      const state = generateOAuthState();
      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: `${getBaseUrl(req)}/auth/callback`,
        scope: "read:user",
        state
      });
      setOAuthStateCookie(res, state);
      res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${params.toString()}` });
      return res.end();
    }

    if (url.pathname === "/auth/callback" && req.method === "GET") {
      if (!isGitHubAuthRequest(req)) return sendJson(res, 404, { error: "GitHub login is not enabled for this host." });
      const { code, state } = Object.fromEntries(url.searchParams);
      if (!code || !state) return sendJson(res, 400, { error: "Missing code or state." });
      if (!consumeOAuthState(state)) {
        return sendJson(res, 401, { error: "Invalid or expired state parameter." });
      }
      clearOAuthStateCookie(res);
      const accessToken = await exchangeGitHubCode(code, getBaseUrl(req));
      const user = await fetchGitHubUser(accessToken);
      if (!isAllowedGitHubLogin(user.login)) {
        throw httpError(403, "This GitHub account is not allowed to access this vault.");
      }
      const sessionId = createSession({
        userId: String(user.id),
        userName: user.name || user.login,
        userAvatar: user.avatar_url,
        userLogin: user.login
      });
      setSessionCookie(res, sessionId);
      res.writeHead(302, { Location: `${getBaseUrl(req)}/` });
      return res.end();
    }

    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const session = getSession(req);
      if (session) destroySession(session.id);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
      return sendJson(res, 200, await getHealth());
    }

    if (url.pathname === "/api/config/public" && req.method === "GET") {
      return sendJson(res, 200, await getPublicConfig(req));
    }

    if (url.pathname === "/api/captures/recent" && req.method === "GET") {
      requireWriteAuth(req);
      const limit = Math.min(Number(url.searchParams.get("limit") || "12"), 50);
      return sendJson(res, 200, await executeCapability("capture.recent", { limit }));
    }

    if (url.pathname === "/api/captures" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 201, await executeCapability("capture.append", body));
    }

    if (url.pathname === "/api/captures/update" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateCapture(body));
    }

    if (url.pathname === "/api/index/status" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await getIndexStatus());
    }

    if (url.pathname === "/api/index/run" && req.method === "POST") {
      requireWriteAuth(req);
      return sendJson(res, 200, await runVaultIndex());
    }

    if (url.pathname === "/api/settings/ignore-rules" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await getEditableIndexIgnoreRules());
    }

    if (url.pathname === "/api/settings/ignore-rules" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateEditableIndexIgnoreRules(body));
    }

    if (url.pathname === "/api/mcp/audit" && req.method === "GET") {
      requireWriteAuth(req);
      const limit = Math.min(Number(url.searchParams.get("limit") || "12"), 50);
      return sendJson(res, 200, await getMcpAuditStatus(limit));
    }

    if (url.pathname === "/api/dashboard" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await executeCapability("dashboard.summary"));
    }

    if (url.pathname === "/api/personal-sprint" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await executeCapability("sprint.current", { view: url.searchParams.get("view") || "" }));
    }

    if (url.pathname === "/api/personal-sprint/checkbox" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updatePersonalSprintCheckbox(body));
    }

    if (url.pathname === "/api/personal-sprint/daily-focus" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await executeCapability("sprint.set_daily_focus", body));
    }

    if (url.pathname === "/api/notes/search" && req.method === "GET") {
      requireWriteAuth(req);
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
      return sendJson(res, 200, await executeCapability("vault.search", { query, limit }));
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await executeCapability("chat.send_message", body));
    }

    if (url.pathname === "/api/chat/stream" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return streamChatResponse(res, body);
    }

    if (url.pathname === "/api/chat/capture-summary" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await summarizeChatCapture(body));
    }

    if (url.pathname === "/api/chat/capture" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await captureChatSummary(body));
    }

    if (url.pathname === "/api/chat/extract-todos" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await extractChatTodos(body));
    }

    if (url.pathname === "/api/chat/create-note" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await createStructuredChatNote(body));
    }

    if (url.pathname === "/api/reviews/monthly-fleeting" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await createMonthlyFleetingReview(body));
    }

    if (url.pathname === "/api/chat/references" && req.method === "GET") {
      requireWriteAuth(req);
      const kind = url.searchParams.get("kind") || "";
      const query = url.searchParams.get("q") || "";
      return sendJson(res, 200, await getChatReferenceSuggestions(kind, query));
    }

    if (url.pathname === "/api/chat/context-suggestions" && req.method === "GET") {
      requireWriteAuth(req);
      const query = url.searchParams.get("q") || "";
      return sendJson(res, 200, await getChatContextSuggestions(query));
    }

    if (url.pathname === "/api/chat/skills" && req.method === "GET") {
      requireWriteAuth(req);
      const query = url.searchParams.get("q") || "";
      return sendJson(res, 200, await getChatSkills(query));
    }

    if (url.pathname === "/api/chat/models" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await getChatModels());
    }

    if (url.pathname === "/api/chat/sessions" && req.method === "GET") {
      requireWriteAuth(req);
      const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
      return sendJson(res, 200, await listChatSessions(limit));
    }

    if (url.pathname === "/api/chat/session" && req.method === "GET") {
      requireWriteAuth(req);
      const sessionPath = url.searchParams.get("path") || "";
      return sendJson(res, 200, await readChatSession(sessionPath));
    }

    if (url.pathname === "/api/chat/session" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 201, await createChatSession(body));
    }

    if (url.pathname === "/api/chat/session/update" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateChatSession(body));
    }

    if (url.pathname === "/api/chat/session/delete" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await deleteChatSession(body));
    }

    if (url.pathname === "/api/deep-work/sessions" && req.method === "GET") {
      requireWriteAuth(req);
      return sendJson(res, 200, await listDeepWorkSessions(Number(url.searchParams.get("limit") || "8")));
    }

    if (url.pathname === "/api/deep-work/start" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await startDeepWorkSession(body));
    }

    if (url.pathname === "/api/deep-work/stop" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await stopDeepWorkSession(body));
    }

    if (url.pathname === "/api/tasks" && req.method === "GET") {
      requireWriteAuth(req);
      const status = url.searchParams.get("status") || "open";
      const scope = url.searchParams.get("scope") || "all";
      const source = url.searchParams.get("source") || "all";
      const focus = url.searchParams.get("focus") || "all";
      const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 200);
      return sendJson(res, 200, await executeCapability("tasks.list", { status, scope, source, focus, limit }));
    }

    if (url.pathname === "/api/tasks/toggle" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await executeCapability("tasks.complete", body));
    }

    if (url.pathname === "/api/tasks/triage" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await triageTask(body));
    }

    if (url.pathname === "/api/tasks/update" && req.method === "POST") {
      requireWriteAuth(req);
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateTask(body));
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: error.message || "Unexpected server error" });
  }
});

const mcpServer = createMcpHttpServer({
  enabled: MCP_ENABLED,
  host: MCP_HOST,
  port: MCP_PORT,
  token: MCP_TOKEN,
  appSecret: APP_SECRET,
  allowedToolSet: MCP_ALLOWED_TOOL_SET,
  clientToolAllowlists: MCP_CLIENT_TOOL_ALLOWLISTS,
  capabilities: SECOND_BRAIN_CAPABILITIES,
  capabilityDefinitions: CAPABILITY_DEFINITIONS,
  executeCapability,
  auditLog: MCP_AUDIT_LOG,
  allowedOrigins: MCP_ALLOWED_ORIGINS,
  rateLimitWindowMs: MCP_RATE_LIMIT_WINDOW_MS,
  rateLimitMax: MCP_RATE_LIMIT_MAX,
  toVaultPath
});

function requireWriteAuth(req) {
  const mode = getAuthMode(req);
  const session = getSession(req);
  if (mode === "github") {
    if (session) return;
    throw httpError(401, "Not authenticated.");
  }
  if (mode === "passcode") {
    if (!APP_SECRET) throw httpError(401, "App passcode is not configured.");
    const header = req.headers["x-second-brain-secret"] || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    const provided = String(header || bearer || "");
    if (!timingSafeEqual(provided, APP_SECRET)) {
      throw httpError(401, "App passcode required.");
    }
    return;
  }
  if (session) return;
  if (APP_SECRET) throw httpError(401, "App passcode required.");
  if (GITHUB_ENABLED) throw httpError(401, "Not authenticated.");
}

async function executeCapability(name, input = {}) {
  if (!CAPABILITY_DEFINITIONS.has(name)) throw httpError(404, `Unknown capability: ${name}`);

  switch (name) {
    case "capture.append": {
      const capture = await appendCapture(input);
      return { capture, monthlyFile: getCurrentMonthlyCaptureFile() };
    }
    case "capture.recent": {
      const limit = clampNumber(input?.limit, 12, 1, 50);
      const captures = await readRecentCaptures(limit);
      return { captures, monthlyFile: getCurrentMonthlyCaptureFile() };
    }
    case "tasks.create": {
      const capture = await appendCapture({ ...input, category: "todo" });
      return { capture, monthlyFile: getCurrentMonthlyCaptureFile() };
    }
    case "tasks.list":
      return getTasks({
        status: input?.status || "open",
        scope: input?.scope || "all",
        source: input?.source || "all",
        focus: input?.focus || "all",
        limit: clampNumber(input?.limit, 100, 1, 200)
      });
    case "tasks.complete":
      return toggleTask({
        ...input,
        status: typeof input?.done === "boolean" ? (input.done ? "done" : "open") : input?.status
      });
    case "sprint.current":
      return getPersonalSprint(input?.view || "");
    case "sprint.set_daily_focus":
      return updatePersonalSprintDailyFocus(input);
    case "dashboard.summary":
      return getDashboard();
    case "vault.search":
      return searchNotes(input?.query || input?.q || "", clampNumber(input?.limit, 20, 1, 50));
    case "chat.send_message":
      return answerChat(input);
    default:
      throw httpError(501, `Capability is not implemented yet: ${name}`);
  }
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseListEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseMcpClientToolAllowlists(value) {
  const scopes = new Map();
  for (const rawScope of String(value || "").split(";")) {
    const [rawClient, rawTools] = rawScope.split(":");
    const client = String(rawClient || "").trim().toLowerCase();
    if (!client) continue;
    const tools = String(rawTools || "")
      .split("|")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (tools.length) scopes.set(client, new Set(tools));
  }
  return scopes;
}

function isAllowedGitHubLogin(login) {
  const normalized = String(login || "").trim().toLowerCase();
  return Boolean(normalized && GITHUB_ALLOWED_LOGINS.includes(normalized));
}

const sessionStore = new Map();
const oauthStates = new Map();

function getCookieValue(req, name) {
  const raw = req.headers.cookie || "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function getSession(req) {
  const sessionId = getCookieValue(req, "sb_session");
  if (!sessionId) return null;
  const session = sessionStore.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessionStore.delete(sessionId);
    return null;
  }
  return { id: sessionId, ...session };
}

function createSession(user) {
  const id = crypto.randomUUID();
  sessionStore.set(id, {
    ...user,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000
  });
  return id;
}

function destroySession(sessionId) {
  sessionStore.delete(sessionId);
}

function setSessionCookie(res, sessionId, { maxAge = SESSION_MAX_AGE } = {}) {
  const cookie = `sb_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  appendCookieHeader(res, cookie);
}

function clearSessionCookie(res) {
  appendCookieHeader(res, "sb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function setOAuthStateCookie(res, state) {
  appendCookieHeader(res, `sb_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`);
}

function clearOAuthStateCookie(res) {
  appendCookieHeader(res, "sb_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function appendCookieHeader(res, cookie) {
  const existing = res.getHeader("Set-Cookie") || [];
  const headers = Array.isArray(existing) ? existing : [existing];
  headers.push(cookie);
  res.setHeader("Set-Cookie", headers);
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `${HOST}:${PORT}`;
  return `${proto}://${host}`;
}

function generateOAuthState() {
  const state = crypto.randomUUID();
  oauthStates.set(state, Date.now());
  return state;
}

function consumeOAuthState(state) {
  const ts = oauthStates.get(state);
  oauthStates.delete(state);
  return Boolean(ts && Date.now() - ts < 300000);
}

async function exchangeGitHubCode(code, baseUrl) {
  if (TEST_GITHUB_USER_JSON) return "test-github-access-token";
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${baseUrl}/auth/callback`
    })
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw httpError(502, data.error_description || data.error || "GitHub OAuth token exchange failed.");
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken) {
  if (TEST_GITHUB_USER_JSON) {
    try {
      return JSON.parse(TEST_GITHUB_USER_JSON);
    } catch {
      throw httpError(500, "TEST_GITHUB_USER_JSON is not valid JSON.");
    }
  }
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "Authorization": `Bearer ${accessToken}`
    }
  });
  if (!response.ok) throw httpError(502, "Failed to fetch GitHub user info.");
  return response.json();
}

async function getAuthUser(req) {
  const mode = getAuthMode(req);
  const session = getSession(req);
  if (mode === "github") {
    if (!session) throw httpError(401, "Not authenticated.");
    return {
      authenticated: true,
      method: "github",
      id: session.userId,
      name: session.userName,
      login: session.userLogin,
      avatar: session.userAvatar
    };
  }
  if (mode === "passcode") {
    throw httpError(401, "Passcode required.");
  }
  if (!session) {
    return { authenticated: false, method: "none" };
  }
  return {
    authenticated: true,
    method: "github",
    id: session.userId,
    name: session.userName,
    login: session.userLogin,
    avatar: session.userAvatar
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore) {
    if (session.expiresAt <= now) sessionStore.delete(id);
  }
  for (const [state, ts] of oauthStates) {
    if (now - ts > 300000) oauthStates.delete(state);
  }
}, 60000);

server.listen(PORT, HOST, () => {
  console.log(`Second Brain App running at http://${HOST}:${PORT}`);
  console.log(`Vault path: ${VAULT_PATH}`);
  if (VAULT_WATCH_ENABLED) {
    startVaultWatcher();
  } else {
    watcherState.enabled = false;
    watcherState.recursive = false;
    watcherState.status = NIGHTLY_INDEX_ENABLED ? "scheduled" : "disabled";
    watcherState.lastError = null;
    console.log("Vault watcher disabled; using the last good index until manual or scheduled rebuild.");
  }
  if (AUTO_INDEX_ON_START) {
    scheduleVaultIndex("startup", IS_ICLOUD_VAULT ? ICLOUD_STARTUP_INDEX_DELAY_MS : 500);
  }
  startNightlyIndexScheduler();
});

if (mcpServer) {
  mcpServer.listen(MCP_PORT, MCP_HOST, () => {
    console.log(`Second Brain MCP running at http://${MCP_HOST}:${MCP_PORT}/mcp`);
  });
}

async function loadDotEnv(envPath) {
  try {
    const file = await fs.readFile(envPath, "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function getHealth() {
  const vault = await pathExists(VAULT_PATH);
  const fleetingDir = await pathExists(getFleetingDir());
  const index = await getIndexStatus();
  return {
    ok: vault && fleetingDir,
    vault: {
      configured: Boolean(VAULT_PATH),
      reachable: vault,
      name: path.basename(VAULT_PATH),
      path: VAULT_PATH
    },
    capture: {
      fleetingDirReachable: fleetingDir,
      monthlyFile: getCurrentMonthlyCaptureFile()
    },
    index: {
      ready: index.ready,
      lastRunAt: index.lastRunAt,
      dbPath: DB_PATH,
      watcher: index.watcher
    },
    security: {
      authRequired: Boolean(APP_SECRET) || GITHUB_ENABLED,
      githubAvailable: GITHUB_ENABLED,
      githubAuthHosts: GITHUB_AUTH_HOSTS,
      appSecretAuthHosts: APP_SECRET_AUTH_HOSTS,
      lanAccess: isLanBound(),
      warning: getLanWarning()
    },
    runtime: getRuntimeState()
  };
}

async function getPublicConfig(req) {
  const ignoreRules = await getIndexIgnoreRulePreview();
  const [backups, chatRuntime, index] = await Promise.all([
    getBackupState(),
    getChatRuntimeStatus(),
    getIndexStatus()
  ]);
  const authMode = getAuthMode(req);
  const githubAvailable = authMode === "github";
  const passcodeAvailable = authMode === "passcode";
  return {
    appName: "Second Brain Capture",
    vaultName: path.basename(VAULT_PATH),
    vaultPath: VAULT_PATH,
    host: HOST,
    port: PORT,
    localUrl: `http://127.0.0.1:${PORT}`,
    lanUrl: isLanBound() ? `http://<your-mac-ip>:${PORT}` : "",
    lanAccess: isLanBound(),
    authRequired: authMode !== "none",
    authMode,
    githubAvailable,
    passcodeAvailable,
    securityWarning: getLanWarning(req),
    currentMonth: getCurrentMonthSlug(),
    monthlyFile: getCurrentMonthlyCaptureFile(),
    targetFile: getCurrentMonthlyCaptureFile(),
    ignoreRules,
    backups,
    operations: {
      runtime: getRuntimeState(),
      mcp: getMcpRuntimeState(),
      index: {
        ready: index.ready,
        noteCount: index.noteCount,
        taskCount: index.taskCount,
        openTaskCount: index.openTaskCount,
        skippedCount: index.skippedCount,
        durationMs: index.durationMs,
        lastRunAt: index.lastRunAt,
        watcher: index.watcher
      },
      service: {
        label: "com.vamshi.second-brain-app",
        chatProvider: getChatProvider(),
        hermesLabel: "webapp managed",
        hermesAutoStart: HERMES_AUTO_START,
        hermesHost: HERMES_HOST,
        hermesPort: HERMES_PORT,
        hermesCwd: VAULT_PATH,
        installCommand: "npm run service:install",
        statusCommand: "npm run service:status",
        logsCommand: "npm run service:logs",
        docs: "docs/mac-mini-service.md"
      }
    },
    chat: {
      enabled: isHermesChatProvider() ? Boolean(HERMES_BASE_URL) : Boolean(DEEPSEEK_API_KEY),
      provider: getChatProvider(),
      model: getConfiguredChatModel(DEEPSEEK_DEFAULT_THINKING),
      regularModel: getConfiguredChatModel("disabled"),
      thinkingModel: getConfiguredChatModel("enabled"),
      defaultThinking: DEEPSEEK_DEFAULT_THINKING,
      trainingOptOut: DEEPSEEK_TRAINING_OPT_OUT,
      contextLimit: CHAT_CONTEXT_LIMIT,
      sessionsDir: CHAT_SESSIONS_DIR,
      hermesBaseUrl: isHermesChatProvider() ? HERMES_BASE_URL : "",
      runtime: chatRuntime
    },
    categories: Array.from(CAPTURE_CATEGORIES)
  };
}

async function getMcpAuditStatus(limit = 12) {
  return {
    ...getMcpRuntimeState(),
    entries: await readMcpAuditEntries(MCP_AUDIT_LOG, limit)
  };
}

function getMcpRuntimeState() {
  return {
    enabled: MCP_ENABLED,
    host: MCP_HOST,
    port: MCP_PORT,
    url: MCP_ENABLED ? `http://${isLanBoundHost(MCP_HOST) ? "<your-mac-ip>" : MCP_HOST}:${MCP_PORT}/mcp` : "",
    auth: MCP_TOKEN ? "MCP_TOKEN" : (MCP_ENABLED && isLoopbackHost(MCP_HOST) && APP_SECRET ? "APP_SECRET fallback" : "not configured"),
    allowedTools: Array.from(MCP_ALLOWED_TOOL_SET),
    clientScopes: Array.from(MCP_CLIENT_TOOL_ALLOWLISTS.entries()).map(([client, tools]) => ({ client, tools: Array.from(tools) })),
    allowedOrigins: MCP_ALLOWED_ORIGINS,
    rateLimit: {
      windowMs: MCP_RATE_LIMIT_WINDOW_MS,
      max: MCP_RATE_LIMIT_MAX
    },
    auditLog: MCP_AUDIT_LOG
  };
}

function isLanBoundHost(host) {
  return ["0.0.0.0", "::"].includes(String(host || "").trim());
}

function getAuthMode(req) {
  const host = getRequestHostname(req);
  if (GITHUB_ENABLED && hostMatches(host, GITHUB_AUTH_HOSTS)) return "github";
  if (APP_SECRET && hostMatches(host, APP_SECRET_AUTH_HOSTS)) return "passcode";
  if (APP_SECRET && isLocalOrPrivateHost(host) && !hostMatches(host, GITHUB_AUTH_HOSTS)) return "passcode";
  if (GITHUB_ENABLED) return "github";
  if (APP_SECRET) return "passcode";
  return "none";
}

function isGitHubAuthRequest(req) {
  return getAuthMode(req) === "github";
}

function getRequestHostname(req) {
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req.headers.host || "");
  return host.replace(/^\[/, "").replace(/\]$/, "").split(":")[0].trim().toLowerCase();
}

function hostMatches(host, hosts) {
  if (!host || !Array.isArray(hosts) || !hosts.length) return false;
  return hosts.some((candidate) => candidate === host);
}

function isLocalOrPrivateHost(host) {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function getRuntimeState() {
  return {
    startedAt: SERVER_STARTED_AT,
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV || "development",
    cwd: __dirname,
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    autoIndexOnStart: AUTO_INDEX_ON_START,
    watchDebounceMs: WATCH_DEBOUNCE_MS
  };
}

async function getBackupState() {
  const [app, vault] = await Promise.all([
    getGitSummary(__dirname),
    getGitSummary(VAULT_PATH)
  ]);
  return { app, vault };
}

async function getGitSummary(repoPath) {
  const gitDir = path.join(repoPath, ".git");
  if (!(await pathExists(gitDir))) {
    return { available: false, path: repoPath, dirty: false, count: 0, summary: "not a git repo" };
  }

  try {
    const output = await runProcess("git", ["-C", repoPath, "status", "--short"]);
    const lines = output.split(/\r?\n/).filter(Boolean);
    return {
      available: true,
      path: repoPath,
      dirty: lines.length > 0,
      count: lines.length,
      summary: lines.length ? `${lines.length} uncommitted change${lines.length === 1 ? "" : "s"}` : "clean"
    };
  } catch (error) {
    return { available: false, path: repoPath, dirty: false, count: 0, summary: error.message };
  }
}

function isLanBound() {
  return HOST === "0.0.0.0" || HOST === "::";
}

function getLanWarning(req = null) {
  if (!isLanBound()) return "";
  const mode = req ? getAuthMode(req) : "";
  if (mode === "passcode") return "LAN access is enabled and write actions require the app passcode.";
  if (mode === "github") return "LAN access is enabled and write actions require GitHub login.";
  if (GITHUB_ENABLED && APP_SECRET) return "LAN access is enabled. Public hosts use GitHub login; local/private hosts use the app passcode.";
  if (GITHUB_ENABLED) return "LAN access is enabled and write actions require GitHub login.";
  if (APP_SECRET) return "LAN access is enabled and write actions require the app passcode.";
  return "LAN access is enabled without a passcode. Devices on your network can write to this vault.";
}

async function getIndexIgnoreRulePreview() {
  await loadIndexIgnoreRules();
  return [...indexIgnoreRules];
}

async function getEditableIndexIgnoreRules() {
  await loadIndexIgnoreRules();
  return {
    rules: [...indexIgnoreRules],
    filePath: INDEX_IGNORE_FILE
  };
}

async function updateEditableIndexIgnoreRules(body = {}) {
  const rawRules = Array.isArray(body?.rules)
    ? body.rules
    : String(body?.rules || "").split(/\r?\n/);
  const rules = [];
  for (const rawRule of rawRules) {
    const rule = normalizeEditableIgnoreRule(rawRule);
    if (!rule) continue;
    if (!rules.includes(rule)) rules.push(rule);
  }

  await fs.mkdir(path.dirname(INDEX_IGNORE_FILE), { recursive: true });
  const markdown = [
    "# Task ignore rules",
    "# One vault-relative file or folder per line. Simple * wildcards are supported.",
    "# These paths are hidden from Tasks only; chat and file lookup still index notes.",
    ...rules
  ].join("\n");
  await fs.writeFile(INDEX_IGNORE_FILE, `${markdown}\n`, "utf8");
  await loadIndexIgnoreRules();
  scheduleVaultIndex("ignore-rules-updated", 100);
  return await getEditableIndexIgnoreRules();
}

function normalizeEditableIgnoreRule(rule) {
  const normalized = normalizeIgnoreRule(rule);
  if (!normalized) return "";
  if (normalized.includes("..")) throw httpError(400, "Ignore rules must be vault-relative paths.");
  return normalized;
}

async function ensureIndexSchema() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await dbExec(`
    CREATE TABLE IF NOT EXISTS notes_metadata (
      note_id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type TEXT,
      name TEXT,
      para TEXT,
      project TEXT,
      created TEXT,
      updated TEXT,
      tags TEXT,
      headings TEXT,
      snippet TEXT,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      text TEXT NOT NULL,
      priority TEXT,
      due TEXT,
      effort TEXT,
      important TEXT,
      urgent TEXT,
      project TEXT,
      context TEXT,
      updated TEXT
    );

    CREATE TABLE IF NOT EXISTS index_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at TEXT NOT NULL,
      note_count INTEGER NOT NULL,
      task_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL
    );
  `);
  await ensureTaskColumn("important");
  await ensureTaskColumn("urgent");
  await ensureTaskColumn("effort");
  await ensureNoteColumn("type");
  await ensureNoteColumn("name");
}

async function ensureTaskColumn(columnName) {
  try {
    await dbExec(`ALTER TABLE tasks ADD COLUMN ${columnName} TEXT;`);
  } catch (error) {
    if (!/duplicate column name/i.test(error.message)) throw error;
  }
}

async function ensureNoteColumn(columnName) {
  try {
    await dbExec(`ALTER TABLE notes_metadata ADD COLUMN ${columnName} TEXT;`);
  } catch (error) {
    if (!/duplicate column name/i.test(error.message)) throw error;
  }
}

async function getIndexStatus() {
  await ensureIndexSchema();
  const rows = await dbQuery(`
    SELECT
      (SELECT COUNT(*) FROM notes_metadata) AS note_count,
      (SELECT COUNT(*) FROM tasks WHERE status = 'open') AS open_task_count,
      (SELECT COUNT(*) FROM tasks) AS task_count,
      (SELECT ran_at FROM index_runs ORDER BY id DESC LIMIT 1) AS last_run_at,
      (SELECT skipped_count FROM index_runs ORDER BY id DESC LIMIT 1) AS skipped_count,
      (SELECT duration_ms FROM index_runs ORDER BY id DESC LIMIT 1) AS duration_ms
  `);
  const row = rows[0] || {};
  return {
    ready: Number(row.note_count || 0) > 0,
    noteCount: Number(row.note_count || 0),
    taskCount: Number(row.task_count || 0),
    openTaskCount: Number(row.open_task_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    durationMs: Number(row.duration_ms || 0),
    lastRunAt: row.last_run_at || null,
    dbPath: DB_PATH,
    watcher: getWatcherPublicState()
  };
}

async function runVaultIndex({ reason = "manual" } = {}) {
  if (activeIndexPromise) {
    watcherState.queued = true;
    return activeIndexPromise;
  }

  activeIndexPromise = performVaultIndex({ reason })
    .catch(async (error) => {
      if (!error.indexPreserved) throw error;
      return createPreservedIndexResult({ reason, error });
    })
    .finally(() => {
      activeIndexPromise = null;
      if (watcherState.queued) {
        watcherState.queued = false;
        scheduleVaultIndex("queued", getIndexDelay("queued", 100));
      }
    });

  return activeIndexPromise;
}

async function performVaultIndex({ reason = "manual" } = {}) {
  const started = Date.now();
  const markdownFiles = [];
  const skipped = { count: 0 };

  await loadIndexIgnoreRules();
  await collectMarkdownFiles(VAULT_PATH, markdownFiles, skipped);

  const notes = [];
  const tasks = [];
  for (const filePath of markdownFiles) {
    const indexedFile = await readMarkdownFileForIndex(filePath, skipped);
    if (!indexedFile) continue;
    const { markdown, stat } = indexedFile;
    const note = parseMarkdownNote({ filePath, markdown, stat });
    if (!shouldIndexNote(note)) {
      skipped.count += 1;
      continue;
    }
    notes.push(note);
    if (shouldSkipRelativeVaultPath(note.path)) {
      skipped.count += 1;
      continue;
    }
    tasks.push(...extractTasks(note, markdown));
  }

  await assertIndexRebuildIsHealthy({ notes, skipped });

  const now = new Date().toISOString();
  const sql = [
    "BEGIN;",
    "DELETE FROM notes_metadata;",
    "DELETE FROM tasks;",
    ...notes.map((note) => `
      INSERT INTO notes_metadata (
        note_id, path, title, type, name, para, project, created, updated, tags, headings, snippet, content
      ) VALUES (
        ${sqlValue(note.noteId)}, ${sqlValue(note.path)}, ${sqlValue(note.title)}, ${sqlValue(note.type)},
        ${sqlValue(note.name)}, ${sqlValue(note.para)}, ${sqlValue(note.project)}, ${sqlValue(note.created)},
        ${sqlValue(note.updated)}, ${sqlValue(note.tags)}, ${sqlValue(note.headings)}, ${sqlValue(note.snippet)},
        ${sqlValue(note.content)}
      );
    `),
    ...tasks.map((task) => `
      INSERT INTO tasks (
        task_id, note_id, path, line_number, status, text, priority, due, effort, important, urgent, project, context, updated
      ) VALUES (
        ${sqlValue(task.taskId)}, ${sqlValue(task.noteId)}, ${sqlValue(task.path)}, ${task.lineNumber},
        ${sqlValue(task.status)}, ${sqlValue(task.text)}, ${sqlValue(task.priority)}, ${sqlValue(task.due)},
        ${sqlValue(task.effort)}, ${sqlValue(task.important)}, ${sqlValue(task.urgent)}, ${sqlValue(task.project)}, ${sqlValue(task.context)},
        ${sqlValue(task.updated)}
      );
    `),
    `
      INSERT INTO index_runs (ran_at, note_count, task_count, skipped_count, duration_ms)
      VALUES (${sqlValue(now)}, ${notes.length}, ${tasks.length}, ${skipped.count}, ${Date.now() - started});
    `,
    "COMMIT;"
  ].join("\n");

  await dbExec(sql);

  return {
    ok: true,
    reason,
    ranAt: now,
    noteCount: notes.length,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => task.status === "open").length,
    skippedCount: skipped.count,
    durationMs: Date.now() - started,
    dbPath: DB_PATH
  };
}

async function reindexMarkdownFile(filePath, { reason = "file-update" } = {}) {
  if (!filePath || !filePath.toLowerCase().endsWith(".md")) return null;
  const indexedFile = await readMarkdownFileForIndex(filePath, { count: 0 });
  if (!indexedFile) return null;

  const { markdown, stat } = indexedFile;
  const note = parseMarkdownNote({ filePath, markdown, stat });
  const tasks = shouldSkipRelativeVaultPath(note.path) ? [] : extractTasks(note, markdown);
  const now = new Date().toISOString();
  const sql = [
    "BEGIN;",
    `DELETE FROM notes_metadata WHERE path = ${sqlValue(note.path)};`,
    `DELETE FROM tasks WHERE path = ${sqlValue(note.path)};`,
    shouldIndexNote(note) ? `
      INSERT INTO notes_metadata (
        note_id, path, title, type, name, para, project, created, updated, tags, headings, snippet, content
      ) VALUES (
        ${sqlValue(note.noteId)}, ${sqlValue(note.path)}, ${sqlValue(note.title)}, ${sqlValue(note.type)},
        ${sqlValue(note.name)}, ${sqlValue(note.para)}, ${sqlValue(note.project)}, ${sqlValue(note.created)},
        ${sqlValue(note.updated)}, ${sqlValue(note.tags)}, ${sqlValue(note.headings)}, ${sqlValue(note.snippet)},
        ${sqlValue(note.content)}
      );
    ` : "",
    ...tasks.map((task) => `
      INSERT INTO tasks (
        task_id, note_id, path, line_number, status, text, priority, due, effort, important, urgent, project, context, updated
      ) VALUES (
        ${sqlValue(task.taskId)}, ${sqlValue(task.noteId)}, ${sqlValue(task.path)}, ${task.lineNumber},
        ${sqlValue(task.status)}, ${sqlValue(task.text)}, ${sqlValue(task.priority)}, ${sqlValue(task.due)},
        ${sqlValue(task.effort)}, ${sqlValue(task.important)}, ${sqlValue(task.urgent)}, ${sqlValue(task.project)}, ${sqlValue(task.context)},
        ${sqlValue(task.updated)}
      );
    `),
    `
      INSERT INTO index_runs (ran_at, note_count, task_count, skipped_count, duration_ms)
      VALUES (${sqlValue(now)}, (SELECT COUNT(*) FROM notes_metadata), (SELECT COUNT(*) FROM tasks), 0, 0);
    `,
    "COMMIT;"
  ].join("\n");

  await dbExec(sql);
  return { ok: true, reason, path: note.path, taskCount: tasks.length, ranAt: now };
}

async function assertIndexRebuildIsHealthy({ notes, skipped }) {
  if (!skipped.readErrors) return;
  const rows = await dbQuery(`
    SELECT
      (SELECT COUNT(*) FROM notes_metadata) AS current_note_count,
      (SELECT MAX(note_count) FROM index_runs) AS historical_note_count
  `);
  const row = rows[0] || {};
  const baseline = Math.max(Number(row.current_note_count || 0), Number(row.historical_note_count || 0));
  if (baseline > 0 && notes.length < Math.floor(baseline * 0.5)) {
    throw indexPreservedError(
      `Vault index skipped ${skipped.readErrors} unreadable file(s) and found only ${notes.length}/${baseline} expected notes; keeping existing index.`,
      { notesFound: notes.length, baseline, readErrors: skipped.readErrors, skippedCount: skipped.count }
    );
  }
}

function indexPreservedError(message, details = {}) {
  const error = new Error(message);
  error.indexPreserved = true;
  error.details = details;
  return error;
}

async function createPreservedIndexResult({ reason, error }) {
  const status = await getIndexStatus();
  const ranAt = new Date().toISOString();
  return {
    ok: true,
    preserved: true,
    stale: true,
    reason,
    ranAt,
    lastGoodRunAt: status.lastRunAt,
    noteCount: status.noteCount,
    taskCount: status.taskCount,
    openTaskCount: status.openTaskCount,
    skippedCount: status.skippedCount,
    durationMs: 0,
    dbPath: DB_PATH,
    message: error.message,
    details: error.details || {}
  };
}

async function readMarkdownFileForIndex(filePath, skipped) {
  const attempts = IS_ICLOUD_VAULT ? Math.max(1, ICLOUD_READ_RETRY_COUNT) : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const [markdown, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath)
      ]);
      return { markdown, stat };
    } catch (error) {
      lastError = error;
      if (!isRecoverableVaultReadError(error) || attempt === attempts) break;
      await wait(Math.min(250 * attempt, 1000));
    }
  }

  if (!isRecoverableVaultReadError(lastError)) throw lastError;
  skipped.count += 1;
  skipped.readErrors = (skipped.readErrors || 0) + 1;
  skipped.readErrorsLogged = skipped.readErrorsLogged || 0;
  if (skipped.readErrorsLogged < MAX_INDEX_READ_ERROR_LOGS) {
    skipped.readErrorsLogged += 1;
    console.warn(`Vault index skipped unreadable file ${toVaultPath(filePath)}: ${lastError.message}`);
  } else if (skipped.readErrorsLogged === MAX_INDEX_READ_ERROR_LOGS) {
    skipped.readErrorsLogged += 1;
    console.warn("Vault index skipped additional unreadable files; suppressing per-file iCloud read warnings for this pass.");
  }
  return null;
}

function isRecoverableVaultReadError(error) {
  const message = String(error?.message || "");
  return [
    "ENOENT",
    "ENOTDIR",
    "EACCES",
    "EPERM",
    "EBUSY",
    "EIO"
  ].includes(error?.code) || message.includes("Unknown system error -11");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startVaultWatcher() {
  if (vaultWatcher) return;

  try {
    vaultWatcher = watch(VAULT_PATH, { recursive: true }, (eventType, filename) => {
      handleVaultWatchEvent(eventType, filename);
    });
    vaultWatcher.on("error", (error) => {
      watcherState.status = "error";
      watcherState.lastError = error.message;
      console.warn(`Vault watcher error: ${error.message}`);
    });
    watcherState.enabled = true;
    watcherState.recursive = true;
    watcherState.status = "watching";
    watcherState.lastError = null;
    console.log(`Vault watcher active with ${WATCH_DEBOUNCE_MS}ms debounce.`);
  } catch (error) {
    watcherState.enabled = false;
    watcherState.status = "unavailable";
    watcherState.lastError = error.message;
    console.warn(`Vault watcher unavailable: ${error.message}`);
  }
}

function handleVaultWatchEvent(eventType, filename) {
  const relativePath = filename ? String(filename).split(path.sep).join("/") : "";
  if (relativePath && shouldIgnoreWatchEvent(relativePath)) return;

  watcherState.eventCount += 1;
  watcherState.lastEventAt = new Date().toISOString();
  watcherState.lastEventPath = relativePath || "(unknown)";
  scheduleVaultIndex(`watch:${eventType}`, getIndexDelay(`watch:${eventType}`, WATCH_DEBOUNCE_MS));
}

function shouldIgnoreWatchEvent(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  if (!normalized.toLowerCase().endsWith(".md")) return true;
  return shouldSkipVaultPathForIndex(normalized);
}

function scheduleVaultIndex(reason, delayMs = WATCH_DEBOUNCE_MS) {
  watcherState.pending = true;
  watcherState.lastReason = reason;
  windowClearTimeout(indexTimer);
  indexTimer = setTimeout(async () => {
    watcherState.pending = false;
    try {
      const result = await runVaultIndex({ reason });
      watcherState.lastAttemptAt = result.ranAt;
      if (result.preserved) {
        watcherState.lastError = result.message;
        watcherState.status = watcherState.enabled ? "stale" : watcherState.status;
        console.warn(`Vault index kept previous good index (${reason}): ${result.message}`);
        return;
      }
      watcherState.lastRunAt = result.ranAt;
      watcherState.lastError = null;
      watcherState.status = watcherState.enabled ? "watching" : watcherState.status;
      console.log(`Vault index rebuilt (${reason}) in ${result.durationMs}ms.`);
    } catch (error) {
      watcherState.status = "error";
      watcherState.lastError = error.message;
      console.warn(`Vault index rebuild failed (${reason}): ${error.message}`);
    }
  }, delayMs);
}

function startNightlyIndexScheduler() {
  if (!NIGHTLY_INDEX_ENABLED || nightlyIndexTimer) return;
  const nextRun = getNextNightlyIndexRun();
  watcherState.nightlyEnabled = true;
  watcherState.nextNightlyRunAt = nextRun.toISOString();
  const delayMs = Math.max(1000, nextRun.getTime() - Date.now());
  nightlyIndexTimer = setTimeout(runNightlyIndex, delayMs);
  console.log(`Nightly vault index scheduled for ${watcherState.nextNightlyRunAt}.`);
}

async function runNightlyIndex() {
  nightlyIndexTimer = null;
  watcherState.pending = true;
  watcherState.lastReason = "nightly";
  try {
    const result = await runVaultIndex({ reason: "nightly" });
    watcherState.lastAttemptAt = result.ranAt;
    if (result.preserved) {
      watcherState.lastError = result.message;
      watcherState.status = VAULT_WATCH_ENABLED ? "stale" : "scheduled";
      console.warn(`Nightly vault index kept previous good index: ${result.message}`);
      return;
    }
    watcherState.lastRunAt = result.ranAt;
    watcherState.lastError = null;
    watcherState.status = VAULT_WATCH_ENABLED ? "watching" : "scheduled";
    console.log(`Nightly vault index rebuilt in ${result.durationMs}ms.`);
  } catch (error) {
    watcherState.lastError = error.message;
    watcherState.status = VAULT_WATCH_ENABLED ? "error" : "scheduled";
    console.warn(`Nightly vault index failed: ${error.message}`);
  } finally {
    watcherState.pending = false;
    startNightlyIndexScheduler();
  }
}

function getNextNightlyIndexRun(now = new Date()) {
  const next = new Date(now);
  next.setHours(NIGHTLY_INDEX_HOUR, NIGHTLY_INDEX_MINUTE, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function getIndexDelay(reason, fallbackMs = WATCH_DEBOUNCE_MS) {
  if (!IS_ICLOUD_VAULT) return fallbackMs;
  if (String(reason || "").startsWith("watch:")) return Math.max(fallbackMs, ICLOUD_WATCH_DEBOUNCE_MS);
  if (reason === "queued") return Math.max(fallbackMs, Math.floor(ICLOUD_WATCH_DEBOUNCE_MS / 2));
  return fallbackMs;
}

function windowClearTimeout(timer) {
  if (timer) clearTimeout(timer);
}

function getWatcherPublicState() {
  return { ...watcherState };
}

async function loadIndexIgnoreRules() {
  const envRules = String(process.env.INDEX_IGNORE || "")
    .split(",")
    .map((rule) => rule.trim())
    .filter(Boolean);
  const fileRules = [];

  try {
    const file = await fs.readFile(INDEX_IGNORE_FILE, "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      fileRules.push(trimmed);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  indexIgnoreRules = [...envRules, ...fileRules]
    .map(normalizeIgnoreRule)
    .filter(Boolean);
}

function normalizeIgnoreRule(rule) {
  return String(rule || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function matchesIndexIgnore(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  return indexIgnoreRules.some((rule) => matchesIgnoreRule(normalized, rule));
}

function matchesIgnoreRule(relativePath, rule) {
  if (!rule) return false;
  if (rule.includes("*")) {
    const escaped = rule
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${escaped}(?:/.*)?$`).test(relativePath);
  }
  return relativePath === rule || relativePath.startsWith(`${rule}/`);
}

async function searchNotes(query, limit = 20) {
  await ensureIndexSchema();
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    const recent = await dbQuery(`
      SELECT note_id, path, title, para, project, updated, snippet
      FROM notes_metadata
      ORDER BY datetime(updated) DESC
      LIMIT ${Number(limit)}
    `);
    return { query: cleanQuery, results: recent.map(formatNoteRow) };
  }

  const terms = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const conditions = terms
    .map((term) => `LOWER(title || ' ' || path || ' ' || content) LIKE ${sqlValue(`%${escapeLike(term)}%`)} ESCAPE '\\'`)
    .join(" AND ");

  const rows = await dbQuery(`
    SELECT note_id, path, title, para, project, updated, snippet, content
    FROM notes_metadata
    WHERE ${conditions}
    ORDER BY datetime(updated) DESC
    LIMIT ${Number(limit) * 4}
  `);

  const results = rows
    .map((row) => {
      const haystack = `${row.title} ${row.path} ${row.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + countOccurrences(haystack, term), 0);
      return {
        ...formatNoteRow(row),
        score,
        snippet: makeSearchSnippet(row.content || row.snippet || "", terms)
      };
    })
    .sort((a, b) => b.score - a.score || String(b.updated).localeCompare(String(a.updated)))
    .slice(0, limit);

  return { query: cleanQuery, results };
}

async function answerChat(body) {
  if (isHermesChatProvider()) {
    return answerHermesChat(body);
  }
  return answerDeepSeekChat(body);
}

async function answerDeepSeekChat(body) {
  const message = normalizeChatMessage(body?.message);
  const history = normalizeChatHistory(body?.history);
  const thinkingMode = normalizeThinkingMode(body?.thinkingMode);
  const deepWork = normalizeDeepWork(body?.deepWork);
  const references = parseChatReferences(message, body);
  const requestedSessionPath = normalizeOptionalChatSessionPath(body?.sessionPath);
  const existingSession = requestedSessionPath ? await readChatSessionMetadata(requestedSessionPath) : null;
  const [sources, explicitMentor, explicitAssistant, people, autoSkills] = await Promise.all([
    retrieveChatSources([deepWork.goal, message].filter(Boolean).join(" "), CHAT_CONTEXT_LIMIT),
    references.mentor ? getSkillPrompt("mentor", references.mentor) : Promise.resolve(null),
    references.skill ? getSkillPromptAny(references.skill) : references.assistant ? getSkillPrompt("assistant", references.assistant) : Promise.resolve(null),
    references.people.length ? getPeopleContexts(references.people) : Promise.resolve([]),
    routeChatSkills(message, references)
  ]);
  const mentor = explicitMentor || autoSkills.mentor;
  const assistant = explicitAssistant || autoSkills.assistant;

  if (!DEEPSEEK_API_KEY) {
    throw httpError(503, "DEEPSEEK_API_KEY is not configured. Add it to .env to enable vault-aware chat.");
  }

  const response = await callDeepSeekChatCompletion({ message, history, sources, mentor, assistant, people, thinkingMode, deepWork });
  const session = existingSession || await createChatSession({ title: deriveChatSessionTitle(message) });
  await appendChatSessionExchange({
    sessionPath: session.path,
    message,
    response,
    mentor,
    assistant,
    people,
    sources
  });
  await appendDeepWorkExchange({
    deepWork,
    chatSession: session,
    message,
    response,
    skill: explicitAssistant,
    mentor,
    assistant,
    people,
    sources
  });

  return {
    answer: response.answer,
    model: response.model,
    thinkingMode: response.thinkingMode,
    session,
    mentor: mentor ? formatContextSource(mentor) : null,
    assistant: assistant ? formatContextSource(assistant) : null,
    people: people.map(formatContextSource),
    sources: sources.map(formatChatSource),
    deepWork
  };
}

async function answerHermesChat(body) {
  const context = await prepareHermesChatContext(body);

  const response = await callHermesChatCompletion({
    message: context.message,
    history: context.history,
    thinkingMode: context.thinkingMode,
    skill: context.skill,
    people: context.people,
    files: context.files,
    deepWork: context.deepWork
  });
  const session = context.existingSession || await createChatSession({ title: deriveChatSessionTitle(context.message) });
  await appendChatSessionExchange({
    sessionPath: session.path,
    message: context.message,
    response,
    mentor: null,
    assistant: context.skill,
    people: context.people,
    sources: context.files
  });
  await appendDeepWorkExchange({
    deepWork: context.deepWork,
    chatSession: session,
    message: context.message,
    response,
    skill: context.skill,
    people: context.people,
    sources: context.files
  });

  return {
    answer: response.answer,
    model: response.model,
    thinkingMode: response.thinkingMode,
    session,
    mentor: null,
    assistant: context.skill ? formatContextSource(context.skill) : null,
    people: context.people.map(formatContextSource),
    sources: context.files.map(formatChatSource),
    deepWork: context.deepWork
  };
}

async function prepareHermesChatContext(body) {
  const message = normalizeChatMessage(body?.message);
  const history = normalizeChatHistory(body?.history);
  const thinkingMode = normalizeThinkingMode(body?.thinkingMode);
  const deepWork = normalizeDeepWork(body?.deepWork);
  const references = parseChatReferences(message, body);
  const requestedSessionPath = normalizeOptionalChatSessionPath(body?.sessionPath);
  const existingSession = requestedSessionPath ? await readChatSessionMetadata(requestedSessionPath) : null;
  const [skill, people, files] = await Promise.all([
    references.skill ? getSkillPromptAny(references.skill) : Promise.resolve(null),
    references.people.length ? getPeopleContexts(references.people) : Promise.resolve([]),
    references.files.length ? getFileContexts(references.files) : Promise.resolve([])
  ]);
  return { message, history, thinkingMode, deepWork, skill, people, files, existingSession };
}

async function streamChatResponse(res, body) {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const writeEvent = (event) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    if (!isHermesChatProvider()) {
      const result = await answerChat(body);
      writeEvent({ type: "done", ...result });
      return res.end();
    }

    const context = await prepareHermesChatContext(body);
    const session = context.existingSession || await createChatSession({ title: deriveChatSessionTitle(context.message) });
    writeEvent({ type: "session", session });

    let answer = "";
    const response = await callHermesChatCompletionStream({
      message: context.message,
      history: context.history,
      thinkingMode: context.thinkingMode,
      skill: context.skill,
      people: context.people,
      files: context.files,
      deepWork: context.deepWork,
      onDelta: (delta) => {
        answer += delta;
        writeEvent({ type: "delta", delta });
      }
    });

    if (!answer.trim()) answer = response.answer;
    const savedResponse = { ...response, answer };
    await appendChatSessionExchange({
      sessionPath: session.path,
      message: context.message,
      response: savedResponse,
      mentor: null,
      assistant: context.skill,
      people: context.people,
      sources: context.files
    });
    await appendDeepWorkExchange({
      deepWork: context.deepWork,
      chatSession: session,
      message: context.message,
      response: savedResponse,
      skill: context.skill,
      people: context.people,
      sources: context.files
    });

    writeEvent({
      type: "done",
      answer,
      model: response.model,
      thinkingMode: response.thinkingMode,
      session,
      mentor: null,
      assistant: context.skill ? formatContextSource(context.skill) : null,
      people: context.people.map(formatContextSource),
      sources: context.files.map(formatChatSource),
      deepWork: context.deepWork
    });
  } catch (error) {
    writeEvent({ type: "error", error: error.expose ? error.message : "Chat request failed." });
  } finally {
    res.end();
  }
}

function normalizeOptionalChatSessionPath(sessionPath) {
  const cleanPath = String(sessionPath || "").trim();
  return cleanPath ? normalizeChatSessionPath(cleanPath) : "";
}

function normalizeDeepWork(value = {}) {
  const goal = String(value?.goal || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return {
    enabled: Boolean(value?.enabled && goal),
    goal,
    sessionPath: normalizeOptionalDeepWorkSessionPath(value?.sessionPath)
  };
}

function normalizeOptionalDeepWorkSessionPath(sessionPath) {
  const cleanPath = String(sessionPath || "").trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!cleanPath) return "";
  if (!cleanPath.endsWith(".md")) throw httpError(400, "Deep Work session path must be a Markdown file.");
  if (!cleanPath.startsWith(`${DEEP_WORK_SESSIONS_DIR}/`)) {
    throw httpError(400, "Deep Work session path is outside the configured Deep Work folder.");
  }
  if (cleanPath.includes("..")) throw httpError(400, "Invalid Deep Work session path.");
  return cleanPath;
}

function getChatProvider() {
  if (CHAT_PROVIDER === "hermes") return "hermes";
  return "deepseek";
}

function isHermesChatProvider() {
  return getChatProvider() === "hermes";
}

function isVaultAgentChatProvider() {
  return isHermesChatProvider();
}

function getConfiguredChatModel(thinkingMode) {
  if (isHermesChatProvider()) return getHermesModel(thinkingMode);
  return getDeepSeekModel(thinkingMode);
}

async function getChatModels() {
  if (isHermesChatProvider()) {
    const models = await readHermesModels().catch(() => []);
    return {
      provider: "hermes",
      regularModel: HERMES_REGULAR_MODEL,
      thinkingModel: HERMES_THINKING_MODEL,
      models: models.length ? models : [
        { id: HERMES_REGULAR_MODEL, name: HERMES_REGULAR_MODEL },
        { id: HERMES_THINKING_MODEL, name: HERMES_THINKING_MODEL }
      ]
    };
  }

  return {
    provider: "deepseek",
    regularModel: DEEPSEEK_REGULAR_MODEL,
    thinkingModel: DEEPSEEK_THINKING_MODEL,
    models: [
      { id: DEEPSEEK_REGULAR_MODEL, name: DEEPSEEK_REGULAR_MODEL },
      { id: DEEPSEEK_THINKING_MODEL, name: DEEPSEEK_THINKING_MODEL }
    ]
  };
}

async function getChatRuntimeStatus() {
  if (isHermesChatProvider()) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1400);
    try {
      const response = await fetch(getHermesHealthUrl(), {
        headers: getHermesHeaders(),
        signal: controller.signal
      });
      const durationMs = Date.now() - started;
      if (!response.ok) {
        return {
          provider: "hermes",
          status: "error",
          reachable: false,
          baseUrl: HERMES_BASE_URL,
          checkedAt: new Date().toISOString(),
          latencyMs: durationMs,
          detail: `Hermes responded with HTTP ${response.status}`
        };
      }
      return {
        provider: "hermes",
        status: "online",
        reachable: true,
        baseUrl: HERMES_BASE_URL,
        checkedAt: new Date().toISOString(),
        latencyMs: durationMs,
        detail: "Hermes API server reachable"
      };
    } catch (error) {
      return {
        provider: "hermes",
        status: "offline",
        reachable: false,
        baseUrl: HERMES_BASE_URL,
        checkedAt: new Date().toISOString(),
        detail: error.name === "AbortError"
          ? "Hermes health check timed out"
          : `Hermes is not reachable at ${HERMES_BASE_URL}`
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    provider: "deepseek",
    status: DEEPSEEK_API_KEY ? "configured" : "missing-key",
    reachable: Boolean(DEEPSEEK_API_KEY),
    checkedAt: new Date().toISOString(),
    detail: DEEPSEEK_API_KEY ? "DeepSeek API key configured" : "DEEPSEEK_API_KEY is not configured"
  };
}

async function summarizeChatCapture(body = {}) {
  if (!isHermesChatProvider() && !DEEPSEEK_API_KEY) {
    throw httpError(503, "DEEPSEEK_API_KEY is not configured. Add it to .env to enable AI capture summaries.");
  }
  const category = normalizeCaptureSummaryCategory(body?.category);
  const text = normalizeCaptureSummaryInput(body?.text);
  const summary = isHermesChatProvider()
      ? await callHermesCaptureSummary({ category, text })
      : await callDeepSeekCaptureSummary({ category, text });
  return {
    category,
    summary
  };
}

async function captureChatSummary(body = {}) {
  const { category, summary } = await summarizeChatCapture(body);
  const capture = await appendCapture({
    category,
    text: summary,
    source: body?.source || body?.sessionPath || ""
  });
  return {
    category,
    summary,
    capture,
    monthlyFile: getCurrentMonthlyCaptureFile()
  };
}

async function extractChatTodos(body = {}) {
  if (!isHermesChatProvider() && !DEEPSEEK_API_KEY) {
    throw httpError(503, "DEEPSEEK_API_KEY is not configured. Add it to .env to enable AI todo extraction.");
  }
  const text = normalizeCaptureSummaryInput(body?.text);
  const source = body?.source || body?.sessionPath || "";
  const extracted = isHermesChatProvider()
      ? await callHermesTodoExtraction({ text })
      : await callDeepSeekTodoExtraction({ text });
  const todos = extracted.map(normalizeExtractedTodo).filter((todo) => todo.text);
  const captures = [];
  for (const todo of todos.slice(0, 12)) {
    captures.push(await appendCapture({
      category: "todo",
      text: todo.text,
      important: todo.important,
      urgent: todo.urgent,
      due: todo.due,
      source
    }));
  }
  return {
    todos: todos.slice(0, 12),
    captures,
    count: captures.length,
    monthlyFile: getCurrentMonthlyCaptureFile()
  };
}

async function createStructuredChatNote(body = {}) {
  if (!isHermesChatProvider() && !DEEPSEEK_API_KEY) {
    throw httpError(503, "DEEPSEEK_API_KEY is not configured. Add it to .env to enable structured note generation.");
  }
  const text = normalizeCaptureSummaryInput(body?.text);
  const source = normalizeCaptureSource(body?.source || body?.sessionPath);
  const generated = isHermesChatProvider()
      ? await callHermesStructuredNote({ text })
      : await callDeepSeekStructuredNote({ text });
  const note = normalizeStructuredNote(generated);
  const relativePath = await writeStructuredChatNote({ note, source });
  await reindexMarkdownFile(resolveVaultRelativePath(relativePath), { reason: "chat-note" });
  return {
    note: {
      title: note.title,
      path: relativePath,
      summary: note.summary,
      tags: note.tags
    }
  };
}

async function createMonthlyFleetingReview(body = {}) {
  if (!isHermesChatProvider() && !DEEPSEEK_API_KEY) {
    throw httpError(503, "DEEPSEEK_API_KEY is not configured. Add it to .env to enable monthly fleeting reviews.");
  }
  const month = normalizeMonthInput(body?.month);
  const filePath = path.join(getFleetingDir(), `${month}.md`);
  const markdown = await readFileIfExists(filePath);
  if (!markdown.trim()) {
    throw httpError(404, `No fleeting entries found for ${month}.`);
  }
  const sourcePath = toVaultPath(filePath);
  const generated = isHermesChatProvider()
      ? await callHermesMonthlyFleetingReview({ month, markdown })
      : await callDeepSeekMonthlyFleetingReview({ month, markdown });
  const review = normalizeMonthlyFleetingReview(generated, { month });
  const relativePath = await writeMonthlyFleetingReview({ review, month, sourcePath });
  await reindexMarkdownFile(resolveVaultRelativePath(relativePath), { reason: "monthly-fleeting-review" });
  return {
    review: {
      title: review.title,
      path: relativePath,
      month,
      summary: review.summary,
      source: sourcePath,
      tags: review.tags
    }
  };
}

function normalizeCaptureSummaryCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (category === "idea" || category === "reflection" || category === "thought" || category === "log") {
    return category;
  }
  throw httpError(400, "Capture summary category must be idea, reflection, thought, or log.");
}

function normalizeCaptureSummaryInput(value) {
  const text = String(value || "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw httpError(400, "Capture summary text is required.");
  return text.slice(0, 8000);
}

function normalizeChatMessage(value) {
  const message = String(value || "").trim();
  if (!message) throw httpError(400, "Chat message is required.");
  if (message.length > 4000) throw httpError(413, "Chat message is too long.");
  return message;
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim().slice(0, 3000)
    }))
    .filter((item) => item.content)
    .slice(-CHAT_HISTORY_LIMIT);
}

function normalizeThinkingMode(value) {
  return value === "enabled" || value === "disabled" ? value : DEEPSEEK_DEFAULT_THINKING;
}

function getHermesModel(thinkingMode) {
  return thinkingMode === "enabled" ? HERMES_THINKING_MODEL : HERMES_REGULAR_MODEL;
}

async function ensureChatSession(sessionPath, firstMessage = "") {
  const cleanPath = String(sessionPath || "").trim();
  if (cleanPath) {
    return readChatSessionMetadata(cleanPath);
  }
  return createChatSession({ title: deriveChatSessionTitle(firstMessage) });
}

async function createChatSession(body = {}) {
  const now = new Date();
  const title = normalizeSessionTitle(body?.title) || "New chat";
  const id = `chat-${now.toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const filename = `${id}.md`;
  const relativePath = `${CHAT_SESSIONS_DIR}/${filename}`;
  const filePath = resolveVaultRelativePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const markdown = [
    "---",
    `id: ${id}`,
    "type: chat-session",
    `title: ${quoteYaml(title)}`,
    `created: ${now.toISOString()}`,
    `updated: ${now.toISOString()}`,
    "status: active",
    "source: second-brain-app",
    "---",
    "",
    `# ${title}`,
    "",
    "## Conversation",
    ""
  ].join("\n");
  await fs.writeFile(filePath, markdown, "utf8");
  return {
    id,
    title,
    path: relativePath,
    created: now.toISOString(),
    updated: now.toISOString()
  };
}

async function listChatSessions(limit = 20) {
  const dir = resolveVaultRelativePath(CHAT_SESSIONS_DIR);
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { sessions: [], dir: CHAT_SESSIONS_DIR };
  }

  const sessions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    try {
      sessions.push(await readChatSessionMetadata(`${CHAT_SESSIONS_DIR}/${entry.name}`));
    } catch {
      // Ignore malformed session files in the list, but keep the folder usable.
    }
  }

  sessions.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
  return { sessions: sessions.slice(0, Number(limit)), dir: CHAT_SESSIONS_DIR };
}

async function readChatSession(sessionPath) {
  const session = await readChatSessionMetadata(sessionPath);
  const markdown = await fs.readFile(resolveChatSessionPath(session.path), "utf8");
  return {
    session,
    messages: parseChatSessionMessages(markdown)
  };
}

async function readChatSessionMetadata(sessionPath) {
  const relativePath = normalizeChatSessionPath(sessionPath);
  const filePath = resolveChatSessionPath(relativePath);
  const markdown = await fs.readFile(filePath, "utf8");
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  return {
    id: metadata.id || hash(relativePath),
    title: metadata.title || findFirstHeading(body) || path.basename(relativePath, ".md"),
    path: relativePath,
    created: metadata.created || "",
    updated: metadata.updated || ""
  };
}

async function updateChatSession(body = {}) {
  const title = normalizeSessionTitle(body?.title);
  if (!title) throw httpError(400, "Session title is required.");
  return updateMarkdownChatSession(body?.path || body?.sessionPath, title);
}

async function deleteChatSession(body = {}) {
  return deleteMarkdownChatSession(body?.path || body?.sessionPath);
}

async function updateMarkdownChatSession(sessionPath, title) {
  const session = await readChatSessionMetadata(sessionPath);
  const filePath = resolveChatSessionPath(session.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const now = new Date().toISOString();
  const nextMarkdown = updateFrontmatterField(updateFrontmatterField(markdown, "title", quoteYaml(title)), "updated", now);
  await fs.writeFile(filePath, nextMarkdown, "utf8");
  return { session: await readChatSessionMetadata(session.path) };
}

async function deleteMarkdownChatSession(sessionPath) {
  const session = await readChatSessionMetadata(sessionPath);
  await fs.unlink(resolveChatSessionPath(session.path));
  return { deleted: true, path: session.path };
}

async function startDeepWorkSession(body = {}) {
  const goal = String(body?.goal || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!goal) throw httpError(400, "Deep Work goal is required.");
  const now = new Date();
  const existingPath = normalizeOptionalDeepWorkSessionPath(body?.sessionPath);
  if (existingPath) {
    try {
      const filePath = resolveVaultRelativePath(existingPath);
      const markdown = await fs.readFile(filePath, "utf8");
      const updated = ensureDeepWorkSections(updateFrontmatterField(
        updateFrontmatterField(
          updateFrontmatterField(markdown, "goal", quoteYaml(goal)),
          "status",
          "active"
        ),
        "updated",
        now.toISOString()
      ));
      await fs.writeFile(filePath, updated, "utf8");
      return {
        path: existingPath,
        goal,
        status: "active",
        updated: now.toISOString()
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await fs.mkdir(resolveVaultRelativePath(DEEP_WORK_SESSIONS_DIR), { recursive: true });
  const slug = slugifyLookup(goal).slice(0, 48) || "focus";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const relativePath = `${DEEP_WORK_SESSIONS_DIR}/${stamp}-${slug}.md`;
  const markdown = [
    "---",
    `id: deep-work-${hash(relativePath).slice(0, 12)}`,
    "type: deep-work-session",
    "status: active",
    `goal: ${quoteYaml(goal)}`,
    `created: ${now.toISOString()}`,
    `updated: ${now.toISOString()}`,
    "linked_notes: []",
    "---",
    `# Deep Work — ${goal}`,
    "",
    "## Goal",
    goal,
    "",
    "## Context",
    "",
    "- Session started from the Second Brain web app.",
    "",
    "## Conversation",
    "",
    "## Decisions",
    "",
    "## Tasks",
    "",
    "- [ ] Review Deep Work outcomes",
    "",
    "## Recap"
  ].join("\n");
  await fs.writeFile(resolveVaultRelativePath(relativePath), `${markdown}\n`, "utf8");
  return {
    path: relativePath,
    goal,
    status: "active",
    created: now.toISOString(),
    updated: now.toISOString()
  };
}

async function stopDeepWorkSession(body = {}) {
  const sessionPath = normalizeOptionalDeepWorkSessionPath(body?.sessionPath);
  if (!sessionPath) return { stopped: true, path: "" };
  const now = new Date().toISOString();
  const filePath = resolveVaultRelativePath(sessionPath);
  const markdown = await fs.readFile(filePath, "utf8");
  const recap = normalizeDeepWorkRecap(body?.recap);
  let updated = updateFrontmatterField(
    updateFrontmatterField(
      updateFrontmatterField(markdown, "status", "completed"),
      "ended",
      now
    ),
    "updated",
    now
  );
  updated = ensureDeepWorkSections(updated);
  if (recap) {
    updated = appendToMarkdownSection(updated, "Recap", [
      `### ${formatTimestamp(new Date())}`,
      "",
      recap
    ].join("\n"));
  }
  await fs.writeFile(filePath, updated, "utf8");
  let capture = null;
  if (recap && body?.captureReflection) {
    capture = await appendCapture({
      category: "reflection",
      text: `Deep Work recap: ${recap}`,
      source: sessionPath
    });
  }
  return { stopped: true, path: sessionPath, status: "completed", updated: now, capture };
}

async function listDeepWorkSessions(limit = 8) {
  const dir = resolveVaultRelativePath(DEEP_WORK_SESSIONS_DIR);
  let files = [];
  try {
    files = await listMarkdownFilesRecursive(dir, DEEP_WORK_SESSIONS_DIR);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      dir: DEEP_WORK_SESSIONS_DIR,
      stats: getDeepWorkStats([]),
      sessions: []
    };
  }

  const sessions = [];
  for (const relativePath of files) {
    try {
      const session = await readDeepWorkSessionSummary(relativePath);
      if (session.type === "deep-work-session") sessions.push(session);
    } catch {
      // Ignore malformed or partial files; the history should remain usable.
    }
  }

  sessions.sort((a, b) => String(b.updated || b.created || "").localeCompare(String(a.updated || a.created || "")));
  return {
    dir: DEEP_WORK_SESSIONS_DIR,
    stats: getDeepWorkStats(sessions),
    sessions: sessions.slice(0, Math.max(1, Math.min(Number(limit) || 8, 30)))
  };
}

async function listMarkdownFilesRecursive(absDir, relativeDir) {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absPath = path.join(absDir, entry.name);
    const relativePath = `${relativeDir}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFilesRecursive(absPath, relativePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(relativePath);
    }
  }
  return files;
}

async function readDeepWorkSessionSummary(relativePath) {
  const cleanPath = normalizeOptionalDeepWorkSessionPath(relativePath);
  const markdown = await fs.readFile(resolveVaultRelativePath(cleanPath), "utf8");
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const conversation = extractMarkdownSection(body, "Conversation");
  const decisions = extractMarkdownSection(body, "Decisions");
  const tasks = extractMarkdownSection(body, "Tasks");
  const recap = extractMarkdownSection(body, "Recap");
  const goal = metadata.goal || findDeepWorkGoal(body) || path.basename(cleanPath, ".md");
  const created = metadata.created || "";
  const updated = metadata.updated || metadata.ended || created;
  const ended = metadata.ended || "";
  const taskCounts = countMarkdownCheckboxes(tasks);
  return {
    id: metadata.id || hash(cleanPath),
    type: metadata.type || "",
    goal,
    title: goal,
    path: cleanPath,
    status: metadata.status || "active",
    created,
    updated,
    ended,
    conversationTurns: countDeepWorkConversationTurns(conversation),
    decisionsCount: countMeaningfulSectionLines(decisions),
    tasksOpen: taskCounts.open,
    tasksDone: taskCounts.done,
    recapPresent: Boolean(recap.trim()),
    durationMinutes: getDurationMinutes(created, ended || updated)
  };
}

function getDeepWorkStats(sessions) {
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  return {
    total: sessions.length,
    activeCount: sessions.filter((session) => session.status === "active").length,
    completedCount: sessions.filter((session) => session.status === "completed").length,
    last7DaysCount: sessions.filter((session) => {
      const time = Date.parse(session.updated || session.created || "");
      return Number.isFinite(time) && time >= sevenDaysAgo;
    }).length,
    openTaskCount: sessions.reduce((sum, session) => sum + Number(session.tasksOpen || 0), 0)
  };
}

function findDeepWorkGoal(body) {
  return extractMarkdownSection(body, "Goal").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
}

function countDeepWorkConversationTurns(conversation) {
  return Array.from(String(conversation || "").matchAll(/^###\s+.+?\s+—\s+User\s*$/gim)).length;
}

function countMeaningfulSectionLines(section) {
  return String(section || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line && !/^#+\s+/.test(line))
    .length;
}

function countMarkdownCheckboxes(section) {
  const counts = { open: 0, done: 0 };
  for (const match of String(section || "").matchAll(/^\s*[-*]\s+\[([ xX])]\s+/gm)) {
    if (match[1].toLowerCase() === "x") counts.done += 1;
    else counts.open += 1;
  }
  return counts;
}

function getDurationMinutes(startValue, endValue) {
  const start = Date.parse(startValue || "");
  const end = Date.parse(endValue || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function normalizeDeepWorkRecap(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

function ensureDeepWorkSections(markdown) {
  let next = markdown;
  for (const heading of ["Context", "Conversation", "Decisions", "Tasks", "Recap"]) {
    if (!new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m").test(next)) {
      next = `${next.trimEnd()}\n\n## ${heading}\n`;
    }
  }
  return next;
}

function appendToMarkdownSection(markdown, heading, content) {
  const cleanContent = String(content || "").trim();
  if (!cleanContent) return markdown;
  const ensured = ensureDeepWorkSections(markdown);
  const lines = ensured.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (headingIndex === -1) return `${ensured.trimEnd()}\n\n## ${heading}\n\n${cleanContent}\n`;
  let insertIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      insertIndex = index;
      break;
    }
  }
  const before = lines.slice(0, insertIndex).join("\n").trimEnd();
  const after = lines.slice(insertIndex).join("\n").trimStart();
  return after
    ? `${before}\n\n${cleanContent}\n\n${after}\n`
    : `${before}\n\n${cleanContent}\n`;
}

async function callHermesChatCompletion({ message, history, thinkingMode, skill, people, files, deepWork }) {
  const model = getHermesModel(thinkingMode);
  const messages = buildHermesChatMessages({ message, history, skill, people, files, deepWork });
  const started = Date.now();
  const data = await hermesFetch("/chat/completions", {
    method: "POST",
    timeoutMs: HERMES_CHAT_TIMEOUT_MS,
    body: {
      model,
      stream: false,
      messages
    }
  });
  logSlowHermesChat({ started, model, streamed: false });
  return {
    model,
    thinkingMode,
    answer: extractOpenAiCompatibleText(data) || "Hermes did not return a text response."
  };
}

async function callHermesChatCompletionStream({ message, history, thinkingMode, skill, people, files, deepWork, onDelta }) {
  const model = getHermesModel(thinkingMode);
  const messages = buildHermesChatMessages({ message, history, skill, people, files, deepWork });
  const started = Date.now();
  const data = await hermesFetchStream("/chat/completions", {
    method: "POST",
    timeoutMs: HERMES_CHAT_TIMEOUT_MS,
    body: {
      model,
      stream: true,
      messages
    },
    onDelta
  });
  logSlowHermesChat({ started, model, streamed: true });
  return {
    model,
    thinkingMode,
    answer: data.answer || "Hermes did not return a text response."
  };
}

function buildHermesChatMessages({ message, history, skill, people, files, deepWork }) {
  const prompt = buildSelectedContextPrompt({ message, skill, people, files, deepWork });
  return [
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: prompt }
  ];
}

async function callHermesCaptureSummary({ category, text }) {
  const data = await hermesFetch("/chat/completions", {
    method: "POST",
    body: {
      model: HERMES_REGULAR_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            "You convert assistant responses into concise Obsidian fleeting-note captures.",
            "Return only one or two plain sentences.",
            "Capture the key concept, decision, or reusable insight.",
            "Do not include markdown bullets, headings, labels, quotes, source links, or commentary.",
            "Keep it under 60 words."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Capture category: ${category}`,
            "",
            "Assistant response:",
            clipText(text, 6000)
          ].join("\n")
        }
      ]
    }
  });
  const summary = normalizeAiCaptureSummary(extractOpenAiCompatibleText(data));
  if (!summary) throw httpError(502, "Hermes did not return a capture summary.");
  return summary;
}

async function callHermesTodoExtraction({ text }) {
  const data = await hermesFetch("/chat/completions", {
    method: "POST",
    body: {
      model: HERMES_REGULAR_MODEL,
      stream: false,
      messages: [{ role: "user", content: buildTodoExtractionPrompt(text) }]
    }
  });
  return parseTodoExtractionResponse(extractOpenAiCompatibleText(data));
}

async function callHermesStructuredNote({ text }) {
  const data = await hermesFetch("/chat/completions", {
    method: "POST",
    body: {
      model: HERMES_REGULAR_MODEL,
      stream: false,
      messages: [{ role: "user", content: buildStructuredNotePrompt(text) }]
    }
  });
  return parseStructuredNoteResponse(extractOpenAiCompatibleText(data));
}

async function callHermesMonthlyFleetingReview({ month, markdown }) {
  if (TEST_AI_JSON) return parseStructuredNoteResponse(TEST_AI_JSON);
  const data = await hermesFetch("/chat/completions", {
    method: "POST",
    body: {
      model: HERMES_REGULAR_MODEL,
      stream: false,
      messages: [{ role: "user", content: buildMonthlyFleetingReviewPrompt({ month, markdown }) }]
    }
  });
  return parseStructuredNoteResponse(extractOpenAiCompatibleText(data));
}

async function callDeepSeekTodoExtraction({ text }) {
  const endpoint = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const headers = {
    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (DEEPSEEK_TRAINING_OPT_OUT) {
    headers.opt_out = "training";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: DEEPSEEK_REGULAR_MODEL,
      messages: [
        {
          role: "system",
          content: "Extract only concrete actionable todos from a chat transcript. Return valid JSON only."
        },
        {
          role: "user",
          content: buildTodoExtractionPrompt(text)
        }
      ],
      thinking: { type: "disabled" }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || "DeepSeek todo extraction request failed.");
  }

  return parseTodoExtractionResponse(extractDeepSeekText(data));
}

async function callDeepSeekStructuredNote({ text }) {
  const endpoint = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const headers = {
    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (DEEPSEEK_TRAINING_OPT_OUT) {
    headers.opt_out = "training";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: DEEPSEEK_REGULAR_MODEL,
      messages: [
        {
          role: "system",
          content: "Convert a chat transcript into a structured Obsidian Markdown note. Return valid JSON only."
        },
        {
          role: "user",
          content: buildStructuredNotePrompt(text)
        }
      ],
      thinking: { type: "disabled" }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || "DeepSeek structured note request failed.");
  }

  return parseStructuredNoteResponse(extractDeepSeekText(data));
}

async function callDeepSeekMonthlyFleetingReview({ month, markdown }) {
  if (TEST_AI_JSON) return parseStructuredNoteResponse(TEST_AI_JSON);
  const endpoint = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const headers = {
    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (DEEPSEEK_TRAINING_OPT_OUT) {
    headers.opt_out = "training";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: DEEPSEEK_REGULAR_MODEL,
      messages: [
        {
          role: "system",
          content: "Review a month of Obsidian fleeting notes. Return valid JSON only."
        },
        {
          role: "user",
          content: buildMonthlyFleetingReviewPrompt({ month, markdown })
        }
      ],
      thinking: { type: "disabled" }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || "DeepSeek monthly review request failed.");
  }

  return parseStructuredNoteResponse(extractDeepSeekText(data));
}

function buildStructuredNotePrompt(text) {
  return [
    "Create a structured Obsidian Markdown note from this chat transcript.",
    "Return JSON only with this exact shape:",
    "{\"title\":\"clear note title\",\"summary\":\"one sentence summary\",\"tags\":[\"gpt/generated\"],\"body\":\"markdown body without YAML frontmatter\"}",
    "Rules:",
    "- The body must be useful as a standalone draft note.",
    "- Include sections such as Context, Key points, Decisions, Open questions, or Next steps only when useful.",
    "- Use Obsidian-friendly Markdown.",
    "- Do not claim files were changed.",
    "- Do not include YAML frontmatter in body.",
    "- Keep the note concise but not shallow.",
    "",
    "Chat transcript:",
    clipText(text, 12000)
  ].join("\n");
}

function buildMonthlyFleetingReviewPrompt({ month, markdown }) {
  return [
    `Review this Obsidian monthly fleeting note for ${month}.`,
    "Return JSON only with this exact shape:",
    "{\"title\":\"Fleeting Review — YYYY-MM\",\"summary\":\"one sentence summary\",\"tags\":[\"gpt/review\",\"fleeting\"],\"body\":\"markdown body without YAML frontmatter\"}",
    "Rules:",
    "- Preserve the user's voice and intent; do not over-polish into corporate language.",
    "- Identify recurring themes, decisions, open loops, todos, people, domains, and activity patterns when present.",
    "- Surface 3-7 useful next actions or review questions.",
    "- Mention uncertainty when the notes are sparse or ambiguous.",
    "- Do not modify or rewrite the raw log.",
    "- Do not include YAML frontmatter in body.",
    "- Keep the body concise enough to review in one sitting.",
    "",
    "Monthly fleeting Markdown:",
    clipText(markdown, 18000)
  ].join("\n");
}

function buildTodoExtractionPrompt(text) {
  return [
    "Extract concrete todos from this chat transcript.",
    "Return JSON only, with this exact shape:",
    "{\"todos\":[{\"text\":\"short actionable task\",\"important\":true,\"urgent\":false,\"due\":\"YYYY-MM-DD or empty\"}]}",
    "Rules:",
    "- Include only explicit or clearly implied actions the user may want to do.",
    "- Do not include vague ideas, summaries, or completed work.",
    "- Keep task text concise and imperative.",
    "- Use important/urgent only when the transcript gives a clear signal; otherwise false.",
    "- Use due only when an explicit date or deadline is present; otherwise empty string.",
    "- If there are no todos, return {\"todos\":[]}.",
    "",
    "Chat transcript:",
    clipText(text, 10000)
  ].join("\n");
}

function parseTodoExtractionResponse(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const jsonText = extractJsonFromText(raw);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw httpError(502, "AI todo extraction did not return valid JSON.");
  }
  const todos = Array.isArray(parsed) ? parsed : parsed?.todos;
  if (!Array.isArray(todos)) throw httpError(502, "AI todo extraction did not return a todos array.");
  return todos;
}

function parseStructuredNoteResponse(value) {
  const raw = String(value || "").trim();
  if (!raw) throw httpError(502, "AI structured note generation returned empty output.");
  let parsed;
  try {
    parsed = JSON.parse(extractJsonFromText(raw));
  } catch {
    throw httpError(502, "AI structured note generation did not return valid JSON.");
  }
  return parsed;
}

function extractJsonFromText(value) {
  const text = String(value || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const arrayStart = text.indexOf("[");
  const objectStart = text.indexOf("{");
  const starts = [arrayStart, objectStart].filter((index) => index >= 0).sort((a, b) => a - b);
  if (!starts.length) return text;
  const start = starts[0];
  const endChar = text[start] === "[" ? "]" : "}";
  const end = text.lastIndexOf(endChar);
  return end >= start ? text.slice(start, end + 1).trim() : text.slice(start).trim();
}

function normalizeExtractedTodo(todo) {
  const text = normalizeExtractedTodoText(typeof todo === "string" ? todo : todo?.text || todo?.task || todo?.title);
  return {
    text,
    important: parseBooleanInput(todo?.important),
    urgent: parseBooleanInput(todo?.urgent),
    due: normalizeExtractedTodoDue(todo?.due || todo?.deadline)
  };
}

function normalizeExtractedTodoText(value) {
  return String(value || "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function normalizeExtractedTodoDue(value) {
  const due = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "";
}

function normalizeStructuredNote(note = {}) {
  const title = normalizeStructuredNoteTitle(note.title);
  const summary = String(note.summary || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const tags = normalizeStructuredNoteTags(note.tags);
  const body = normalizeStructuredNoteBody(note.body || note.markdown || note.content, { title, summary });
  return { title, summary, tags, body };
}

function normalizeStructuredNoteTitle(value) {
  const title = String(value || "")
    .replace(/^#+\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return title || "Generated chat note";
}

function normalizeStructuredNoteTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(/[,\s]+/);
  const normalized = values
    .map((tag) => String(tag || "").trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return Array.from(new Set(["gpt/generated", ...normalized])).slice(0, 8);
}

function normalizeStructuredNoteBody(value, { title, summary }) {
  const body = String(value || "").replace(/\r\n/g, "\n").trim();
  const cleanBody = body
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(new RegExp(`^#\\s+${escapeRegExp(title)}\\s*`, "i"), "")
    .trim();
  const sections = [];
  if (summary) sections.push(`> [!summary]\n> ${summary}`);
  sections.push(cleanBody || "## Notes\n\n- ");
  return sections.join("\n\n").trim();
}

async function writeStructuredChatNote({ note, source }) {
  const now = new Date();
  const slug = slugifyLookup(note.title).slice(0, 64) || "chat-note";
  const relativePath = await getUniqueStructuredNotePath(`${formatDate(now)}-${slug}.md`);
  const sourceLine = source ? `source: ${quoteYaml(source)}` : "";
  const markdown = [
    "---",
    `title: ${quoteYaml(note.title)}`,
    "type: generated-note",
    `created: ${quoteYaml(now.toISOString())}`,
    "status: draft",
    ...(sourceLine ? [sourceLine] : []),
    "tags:",
    ...note.tags.map((tag) => `  - ${tag}`),
    "---",
    "",
    `# ${note.title}`,
    "",
    note.body,
    "",
    ...(source ? ["---", `Source: ${formatStructuredNoteSource(source)}`] : [])
  ].join("\n");

  const filePath = resolveVaultRelativePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${markdown.trimEnd()}\n`, "utf8");
  return relativePath;
}

async function getUniqueStructuredNotePath(fileName) {
  const baseSlug = path.basename(fileName, ".md");
  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? `-${index + 1}` : "";
    const candidate = `${CHAT_NOTES_DIR}/${baseSlug}${suffix}.md`;
    try {
      await fs.access(resolveVaultRelativePath(candidate));
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
  throw httpError(500, "Could not create a unique structured note path.");
}

function formatStructuredNoteSource(source) {
  if (!source) return "";
  return `[[${source}]]`;
}

function normalizeMonthlyFleetingReview(note = {}, { month }) {
  const title = normalizeStructuredNoteTitle(note.title || `Fleeting Review — ${month}`);
  const summary = String(note.summary || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const tags = normalizeTagList(["gpt/review", "fleeting", ...(Array.isArray(note.tags) ? note.tags : [])]);
  const body = normalizeStructuredNoteBody(note.body || note.markdown || note.content, { title, summary });
  return { title, summary, tags, body };
}

function normalizeTagList(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(/[,\s]+/);
  const normalized = values
    .map((tag) => String(tag || "").trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 8);
}

async function writeMonthlyFleetingReview({ review, month, sourcePath }) {
  const now = new Date();
  const relativePath = await getUniqueMonthlyFleetingReviewPath(`${month}-fleeting-review.md`);
  const markdown = [
    "---",
    `title: ${quoteYaml(review.title)}`,
    "type: monthly-fleeting-review",
    `month: ${quoteYaml(month)}`,
    `created: ${quoteYaml(now.toISOString())}`,
    "status: draft",
    `source: ${quoteYaml(sourcePath)}`,
    "tags:",
    ...review.tags.map((tag) => `  - ${tag}`),
    "---",
    "",
    `# ${review.title}`,
    "",
    review.body,
    "",
    "---",
    `Source: [[${sourcePath}]]`
  ].join("\n");

  const filePath = resolveVaultRelativePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${markdown.trimEnd()}\n`, "utf8");
  return relativePath;
}

async function getUniqueMonthlyFleetingReviewPath(fileName) {
  const baseSlug = path.basename(fileName, ".md");
  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? `-${index + 1}` : "";
    const candidate = `${FLEETING_REVIEWS_DIR}/${baseSlug}${suffix}.md`;
    try {
      await fs.access(resolveVaultRelativePath(candidate));
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
  throw httpError(500, "Could not create a unique monthly review path.");
}

function normalizeMonthInput(value) {
  const month = String(value || getCurrentMonthSlug()).trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw httpError(400, "Month must use YYYY-MM.");
  return month;
}

function buildSelectedContextPrompt({ message, skill, people, files, deepWork }) {
  const contextBlocks = [];
  if (deepWork?.enabled) {
    contextBlocks.push([
      "Deep Work mode:",
      `Goal: ${deepWork.goal}`,
      "Stay focused on this goal. Bias the response toward the current session objective and avoid unrelated exploration unless the user explicitly asks."
    ].join("\n"));
  }
  if (skill) {
    contextBlocks.push([
      `Selected skill context (${skill.path}):`,
      clipText(skill.content, 2200)
    ].join("\n"));
  }
  if (people?.length) {
    contextBlocks.push([
      "Selected people context:",
      people.map((person) => [
        `${person.title || person.name} (${person.path}):`,
        clipText(person.content, CHAT_SELECTED_CONTEXT_ENTRY_LIMIT)
      ].join("\n")).join("\n\n")
    ].join("\n"));
  }
  if (files?.length) {
    contextBlocks.push([
      "Selected file context:",
      files.map((file) => [
        `${file.title} (${file.path}):`,
        clipText(file.content || file.snippet || "", CHAT_SELECTED_CONTEXT_ENTRY_LIMIT)
      ].join("\n")).join("\n\n")
    ].join("\n"));
  }

  if (!contextBlocks.length) return message;
  return [
    message,
    "",
    "---",
    "",
    contextBlocks.join("\n\n")
  ].join("\n");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHermesModels() {
  const data = await hermesFetch("/models");
  const list = Array.isArray(data) ? data : data.data || data.models || [];
  return list
    .map((model) => {
      const id = String(model.id || model.name || model.model || "").trim();
      if (!id) return null;
      return {
        id,
        name: model.name || id
      };
    })
    .filter(Boolean);
}

function getHermesApiUrl(endpoint = "") {
  return `${HERMES_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

function getHermesHealthUrl() {
  try {
    const url = new URL(HERMES_BASE_URL);
    url.pathname = url.pathname.replace(/\/v1\/?$/, "") || "/";
    url.search = "";
    url.hash = "";
    return `${url.toString().replace(/\/+$/, "")}/health`;
  } catch {
    return HERMES_BASE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "") + "/health";
  }
}

function getHermesHeaders({ hasBody = false } = {}) {
  const headers = { "Accept": "application/json" };
  if (hasBody) headers["Content-Type"] = "application/json";
  if (HERMES_API_KEY) headers.Authorization = `Bearer ${HERMES_API_KEY}`;
  return headers;
}

async function hermesFetch(endpoint, { method = "GET", body = null, timeoutMs = HERMES_REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(getHermesApiUrl(endpoint), {
      method,
      headers: getHermesHeaders({ hasBody: body !== null }),
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    const detail = error.name === "AbortError"
      ? "Hermes request timed out"
      : `Hermes server is not reachable at ${HERMES_BASE_URL}. Start hermes gateway run and try again.`;
    throw httpError(error.name === "AbortError" ? 504 : 503, detail);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || data.message || `Hermes request failed: ${method} ${endpoint}`);
  }
  return data;
}

async function hermesFetchStream(endpoint, { method = "POST", body = null, timeoutMs = HERMES_REQUEST_TIMEOUT_MS, onDelta = () => {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(getHermesApiUrl(endpoint), {
      method,
      headers: getHermesHeaders({ hasBody: body !== null }),
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    const detail = error.name === "AbortError"
      ? "Hermes chat request timed out"
      : `Hermes server is not reachable at ${HERMES_BASE_URL}. Start hermes gateway run and try again.`;
    throw httpError(error.name === "AbortError" ? 504 : 503, detail);
  }

  try {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw httpError(response.status, data.error?.message || data.message || `Hermes request failed: ${method} ${endpoint}`);
    }
    if (!response.body) {
      const data = await response.json().catch(() => ({}));
      const answer = extractOpenAiCompatibleText(data);
      if (answer) onDelta(answer);
      return { answer };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    const consumeLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
      if (!payload || payload === "[DONE]") return;
      let data;
      try {
        data = JSON.parse(payload);
      } catch {
        return;
      }
      const delta = extractOpenAiCompatibleDelta(data);
      if (!delta) return;
      answer += delta;
      onDelta(delta);
    };

    const flushBuffer = (force = false) => {
      const lines = buffer.split(/\r?\n/);
      if (force) {
        buffer = "";
        for (const line of lines) consumeLine(line);
        return;
      }
      buffer = lines.pop() || "";
      for (const line of lines) consumeLine(line);
    };

    if (typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
      }
    } else {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        flushBuffer();
      }
    }
    buffer += decoder.decode();
    flushBuffer(true);
    return { answer: answer.trim() };
  } finally {
    clearTimeout(timer);
  }
}

function extractOpenAiCompatibleDelta(data) {
  return (data?.choices || [])
    .map((choice) => {
      const content = choice.delta?.content ?? choice.message?.content ?? choice.text ?? "";
      if (Array.isArray(content)) {
        return content.map((part) => part.text || part.content || "").join("");
      }
      return String(content || "");
    })
    .filter(Boolean)
    .join("");
}

function logSlowHermesChat({ started, model, streamed }) {
  const elapsed = Date.now() - started;
  if (elapsed < HERMES_CHAT_SLOW_LOG_MS) return;
  console.warn(`Hermes chat ${streamed ? "stream" : "request"} took ${elapsed}ms with model ${model}.`);
}

async function appendChatSessionExchange({ sessionPath, message, response, mentor, assistant, people, sources }) {
  const relativePath = normalizeChatSessionPath(sessionPath);
  const filePath = resolveChatSessionPath(relativePath);
  const now = new Date();
  const existing = await fs.readFile(filePath, "utf8");
  const entry = formatChatSessionExchange({ date: now, message, response, mentor, assistant, people, sources });
  const updated = updateSessionFrontmatter(existing, now.toISOString());
  await fs.writeFile(filePath, `${updated.trimEnd()}\n\n${entry}\n`, "utf8");
}

function formatChatSessionExchange({ date, message, response, mentor, assistant, people, sources }) {
  const contextLines = [
    mentor ? `mentor:: [[${mentor.path}|${mentor.title || mentor.name || "mentor"}]]` : "",
    mentor?.autoSelected ? "mentor_selection:: auto" : "",
    assistant ? `assistant:: [[${assistant.path}|${assistant.title || assistant.name || "assistant"}]]` : "",
    assistant?.autoSelected ? "assistant_selection:: auto" : "",
    ...(people || []).map((person) => `person:: [[${person.path}|${person.title || person.name || "person"}]]`),
    ...(sources || []).slice(0, 8).map((source) => `source:: [[${source.path}|${source.title || source.path}]]`)
  ].filter(Boolean);

  return [
    `### ${formatTimestamp(date)} — User`,
    "",
    message.trim(),
    "",
    `### ${formatTimestamp(date)} — Assistant`,
    "",
    `model:: ${response.model}`,
    `thinking:: ${response.thinkingMode}`,
    ...contextLines,
    "",
    response.answer.trim()
  ].join("\n");
}

async function appendDeepWorkExchange({ deepWork, chatSession, message, response, skill, mentor, assistant, people, sources }) {
  if (!deepWork?.enabled || !deepWork.sessionPath) return;
  const relativePath = normalizeOptionalDeepWorkSessionPath(deepWork.sessionPath);
  const filePath = resolveVaultRelativePath(relativePath);
  const now = new Date();
  const markdown = await fs.readFile(filePath, "utf8");
  const contextLines = [
    chatSession?.path ? `chat_session:: [[${chatSession.path}|${chatSession.title || "chat session"}]]` : "",
    skill ? `skill:: [[${skill.path}|${skill.title || skill.name || "skill"}]]` : "",
    mentor ? `mentor:: [[${mentor.path}|${mentor.title || mentor.name || "mentor"}]]` : "",
    assistant ? `assistant:: [[${assistant.path}|${assistant.title || assistant.name || "assistant"}]]` : "",
    ...(people || []).map((person) => `person:: [[${person.path}|${person.title || person.name || "person"}]]`),
    ...(sources || []).slice(0, 8).map((source) => `source:: [[${source.path}|${source.title || source.path}]]`)
  ].filter(Boolean);
  const entry = [
    `### ${formatTimestamp(now)} — User`,
    "",
    message.trim(),
    "",
    `### ${formatTimestamp(now)} — Assistant`,
    "",
    `model:: ${response.model || ""}`,
    `thinking:: ${response.thinkingMode || ""}`,
    ...contextLines,
    "",
    response.answer.trim()
  ].join("\n");
  const updated = updateFrontmatterField(markdown, "updated", now.toISOString());
  await fs.writeFile(filePath, appendToMarkdownSection(updated, "Conversation", entry), "utf8");
}

function parseChatSessionMessages(markdown) {
  const lines = markdown.split(/\r?\n/);
  const messages = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s+—\s+(User|Assistant)\s*$/i);
    if (heading) {
      if (current) messages.push(finalizeSessionMessage(current));
      current = {
        role: heading[2].toLowerCase() === "user" ? "user" : "assistant",
        content: [],
        meta: []
      };
      continue;
    }
    if (current) current.content.push(line);
  }
  if (current) messages.push(finalizeSessionMessage(current));
  return messages;
}

function finalizeSessionMessage(message) {
  const contentLines = [];
  const meta = {};
  for (const line of message.content) {
    const match = line.match(/^([A-Za-z0-9_-]+)::\s*(.+)$/);
    if (message.role === "assistant" && match) {
      const key = match[1];
      if (!meta[key]) meta[key] = [];
      meta[key].push(match[2]);
      continue;
    }
    contentLines.push(line);
  }
  const content = contentLines.join("\n").trim();
  return {
    id: `${message.role}-${hash(content).slice(0, 12)}`,
    role: message.role,
    content,
    model: meta.model?.[0] || "",
    thinkingMode: meta.thinking?.[0] || "",
    sources: [],
    mentor: null,
    assistant: null,
    people: []
  };
}

function updateSessionFrontmatter(markdown, updatedIso) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  const frontmatter = markdown.slice(0, end);
  const rest = markdown.slice(end);
  const nextFrontmatter = /^updated:\s*.*$/m.test(frontmatter)
    ? frontmatter.replace(/^updated:\s*.*$/m, `updated: ${updatedIso}`)
    : `${frontmatter}\nupdated: ${updatedIso}`;
  return `${nextFrontmatter}${rest}`;
}

function deriveChatSessionTitle(message) {
  const clean = String(message || "")
    .replace(/[#/@][A-Za-z0-9_-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? clipText(clean, 72) : `Chat ${formatTimestamp(new Date())}`;
}

function normalizeSessionTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
}

function parseChatReferences(message, body = {}) {
  const text = String(message || "");
  const mentor = firstLookupName([
    body?.mentor,
    ...(isVaultAgentChatProvider() ? [] : Array.from(text.matchAll(/(?:^|\s)#([A-Za-z0-9_-]+)/g), (match) => match[1]))
  ]);
  const skill = firstReferenceInput([
    body?.skill,
    body?.assistant,
    ...Array.from(text.matchAll(/(?:^|\s)\/([A-Za-z0-9_-]+)/g), (match) => match[1])
  ]);
  const assistant = skill;
  const files = uniqueReferenceInputs([
    ...(Array.isArray(body?.files) ? body.files : []),
    ...(isVaultAgentChatProvider() ? Array.from(text.matchAll(/(?:^|\s)#([A-Za-z0-9_-]+)/g), (match) => match[1]) : [])
  ]);
  const people = uniqueReferenceInputs([
    ...(Array.isArray(body?.people) ? body.people : []),
    ...Array.from(text.matchAll(/(?:^|\s)@([A-Za-z0-9_-]+)/g), (match) => match[1])
  ]);

  return { mentor, assistant, skill, people, files };
}

function firstLookupName(values) {
  return uniqueLookupNames(values)[0] || "";
}

function uniqueLookupNames(values) {
  const seen = new Set();
  const names = [];
  for (const value of values) {
    const normalized = normalizeLookupName(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(normalized);
  }
  return names.slice(0, 5);
}

function normalizeLookupName(value) {
  return String(value || "")
    .trim()
    .replace(/^[@#/]+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function firstReferenceInput(values) {
  return uniqueReferenceInputs(values)[0] || null;
}

function uniqueReferenceInputs(values) {
  const seen = new Set();
  const references = [];
  for (const value of values) {
    const reference = normalizeReferenceInput(value);
    if (!reference) continue;
    const key = reference.path ? `path:${reference.path.toLowerCase()}` : `lookup:${reference.lookup}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(reference);
  }
  return references.slice(0, 5);
}

function normalizeReferenceInput(value) {
  if (!value) return null;
  if (typeof value === "object") {
    const pathValue = normalizeReferencePath(value.path);
    const rawLookup = value.token || value.name || value.title || value.id || path.basename(pathValue || "", ".md");
    const lookup = normalizeLookupName(rawLookup);
    if (!pathValue && !lookup) return null;
    return {
      id: String(value.id || value.note_id || pathValue || lookup),
      kind: String(value.kind || ""),
      path: pathValue,
      title: String(value.title || value.name || path.basename(pathValue || "", ".md") || rawLookup || ""),
      name: String(value.name || value.title || rawLookup || ""),
      token: String(value.token || lookup || ""),
      lookup
    };
  }
  const raw = String(value || "").trim().replace(/^[@#/]+/, "");
  const pathValue = normalizeReferencePath(raw);
  const lookup = normalizeLookupName(pathValue ? path.basename(pathValue, ".md") : raw);
  if (!pathValue && !lookup) return null;
  return {
    id: pathValue || lookup,
    kind: "",
    path: pathValue,
    title: path.basename(pathValue || raw, ".md"),
    name: path.basename(pathValue || raw, ".md"),
    token: lookup,
    lookup
  };
}

function normalizeReferencePath(value) {
  const clean = String(value || "").trim().replace(/^#+/, "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return "";
  return clean.includes("/") && clean.toLowerCase().endsWith(".md") ? clean : "";
}

async function getSkillPrompt(type, name) {
  if (!type || !name) return null;
  await ensureIndexSchema();
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, content, updated
    FROM notes_metadata
    WHERE LOWER(COALESCE(type, '')) = ${sqlValue(type)}
    ORDER BY datetime(updated) DESC
  `);
  return rows.find((row) => matchesLookup(row, name)) || null;
}

async function getSkillPromptAny(name) {
  if (!name) return null;
  const vaultSkill = (await readVaultSkills()).find((row) => matchesLookup(row, name));
  if (vaultSkill) return vaultSkill;

  await ensureIndexSchema();
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, content, updated
    FROM notes_metadata
    WHERE LOWER(COALESCE(type, '')) IN ('mentor', 'assistant')
    ORDER BY datetime(updated) DESC
  `);
  return rows.find((row) => matchesLookup(row, name)) || null;
}

async function routeChatSkills(message, references) {
  const [assistantRows, mentorRows] = await Promise.all([
    references.assistant ? Promise.resolve([]) : getReferenceRows("assistant"),
    references.mentor ? Promise.resolve([]) : getReferenceRows("mentor")
  ]);
  return {
    assistant: selectAutoSkill(assistantRows, message, "assistant"),
    mentor: selectAutoSkill(mentorRows, message, "mentor")
  };
}

function selectAutoSkill(rows, message, kind) {
  const terms = extractSkillRouteTerms(message);
  if (!rows.length || !terms.length) return null;

  const threshold = kind === "assistant" ? 5 : 7;
  const scored = rows
    .map((row) => ({ row, score: scoreSkillRoute(row, terms) }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score || suggestionSortValue(a.row).localeCompare(suggestionSortValue(b.row)));

  const [best, second] = scored;
  if (!best) return null;
  if (second && best.score - second.score < 2 && best.score < threshold + 4) return null;
  return {
    ...best.row,
    autoSelected: true,
    routeScore: best.score
  };
}

function extractSkillRouteTerms(message) {
  const routeStopWords = new Set([
    "chat", "give", "help", "make", "need", "please", "show", "tell", "use", "using", "want", "you", "your"
  ]);
  return extractSearchTerms(message)
    .map((term) => slugifyLookup(term))
    .filter((term) => term.length > 2 && !routeStopWords.has(term))
    .slice(0, 12);
}

function scoreSkillRoute(row, terms) {
  const nameText = [
    row.name,
    row.title,
    row.description,
    path.basename(row.path || "", ".md"),
    skillFolderName(row.path || "")
  ].map(slugifyLookup).filter(Boolean);
  const pathText = slugifyLookup(row.path || "");
  const contentText = slugifyLookup(row.content || "");

  return terms.reduce((score, term) => {
    let next = score;
    if (nameText.some((value) => value === term)) next += 10;
    if (nameText.some((value) => value.includes(term) || term.includes(value))) next += 5;
    if (pathText.includes(term)) next += 2;
    if (contentText.includes(term)) next += Math.min(countOccurrences(contentText, term), 4);
    return next;
  }, 0);
}

async function getPeopleContexts(names) {
  await ensureIndexSchema();
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, updated
    FROM notes_metadata
    WHERE LOWER(COALESCE(type, '')) = 'people'
      AND (
        path LIKE '2.Areas/Personal/People/%'
        OR path LIKE '3.Resources/People/%'
      )
    ORDER BY datetime(updated) DESC
  `);
  const selectedRows = names
    .map((name) => findContextRow(rows, name))
    .filter(Boolean);
  return hydrateVaultContextRows(selectedRows);
}

async function getChatReferenceSuggestions(kind, query) {
  await ensureIndexSchema();
  const normalizedKind = normalizeReferenceKind(kind);
  if (!normalizedKind) throw httpError(400, "Reference kind must be mentor, assistant, skill, people, or file.");
  const cleanQuery = normalizeLookupName(query);
  if (normalizedKind === "skill") return getChatSkills(query);
  if (normalizedKind === "file") return getVaultFileSuggestions(query);
  const rows = await getReferenceRows(normalizedKind);
  const suggestions = rows
    .filter((row) => matchesSuggestionQuery(row, cleanQuery))
    .map((row) => ({ row, score: scoreReferenceSuggestion(row, cleanQuery) }))
    .sort((a, b) => b.score - a.score || suggestionSortValue(a.row).localeCompare(suggestionSortValue(b.row)))
    .slice(0, 10)
    .map(({ row, score }) => ({
      id: row.note_id,
      kind: normalizedKind,
      title: row.title,
      name: row.name || row.title,
      token: slugifyLookup(row.name || row.title || path.basename(row.path || "", ".md")),
      path: row.path,
      score
    }));
  return { kind: normalizedKind, query: cleanQuery, suggestions };
}

async function getChatContextSuggestions(query = "") {
  await ensureIndexSchema();
  const analysis = analyzeContextSuggestionQuery(query);
  const terms = analysis.terms;
  if (!terms.length) return { query: "", suggestions: [] };
  const groups = await Promise.all(analysis.lookupTerms.flatMap((term) => [
    getChatSkills(term),
    getChatReferenceSuggestions("people", term),
    getVaultFileSuggestions(term)
  ]));
  const suggestions = mergeContextSuggestions(groups.flatMap((group) => (
    normalizeContextSuggestionGroup(group.suggestions, group.kind)
  )))
    .map((item) => ({
      ...item,
      score: scoreContextSuggestion(item, terms, analysis)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || suggestionSortValue(a).localeCompare(suggestionSortValue(b)))
    .slice(0, 8);
  return { query: terms.join(" "), intents: Array.from(analysis.intents), suggestions };
}

function analyzeContextSuggestionQuery(query) {
  const text = String(query || "");
  const cleanText = text
    .replace(/(?:^|\s)[#/@][A-Za-z0-9_-]*/g, " ")
    .replace(/\[\[[^\]]+]]/g, " ");
  const lower = cleanText.toLowerCase();
  const terms = extractSearchTerms(cleanText);
  const intents = new Set();
  const scope = new Set();

  if (/\b(personal|home|self|family|health|hobby|hobbies)\b/.test(lower)) scope.add("personal");
  if (/\b(career|work|job|corporate|office|professional)\b/.test(lower)) scope.add("career");
  if (/\b(okrs?|objectives?|key results?|krs?|goals?|quarter|fy20\d{2}|q[1-4])\b/.test(lower)) intents.add("okr");
  if (/\b(sprint|weekly|this week|next week|last week|retro|retrospective)\b/.test(lower)) intents.add("sprint");
  if (/\b(deep work|focus session|focused session|recap|decision log|decisions?)\b/.test(lower)) intents.add("deep-work");
  if (/\b(active idea|idea ledger|ideas?|proposal|concept)\b/.test(lower)) intents.add("idea");
  if (/\b(about me|personal system|checklist|cadence|identity|profile|changelog)\b/.test(lower)) intents.add("system");
  if (/\b(person|people|relationship|relationships|who|contact)\b/.test(lower)) intents.add("people");
  if (/\b(tasks?|todos?|due|deadline|do now|schedule|urgent|important)\b/.test(lower)) intents.add("task");
  if (intents.has("okr") && /\bsprint\b/.test(lower)) intents.add("sprint");

  const lookupTerms = new Set(terms);
  for (const intent of intents) {
    for (const term of getIntentLookupTerms(intent)) lookupTerms.add(term);
  }
  for (const item of scope) lookupTerms.add(item);

  return {
    terms,
    lookupTerms: Array.from(lookupTerms).slice(0, 10),
    intents,
    scope
  };
}

function getIntentLookupTerms(intent) {
  if (intent === "okr") return ["okr", "okrs", "objective", "key-result"];
  if (intent === "sprint") return ["sprint", "sprint-plan", "sprint-state"];
  if (intent === "deep-work") return ["deep-work", "focus", "recap"];
  if (intent === "idea") return ["idea", "ideas", "idea-ledger"];
  if (intent === "system") return ["about-me", "personal-system", "checklist"];
  if (intent === "people") return ["people", "person"];
  if (intent === "task") return ["todo", "task"];
  return [];
}

function normalizeContextSuggestionGroup(items = [], fallbackKind) {
  return items
    .filter((item) => !(fallbackKind === "file" && isSkillMarkdownPath(item.path)))
    .map((item) => ({
      id: item.id,
      kind: item.kind || fallbackKind,
      title: item.title || item.name || item.token || item.path || "Context",
      name: item.name || item.title || item.token || "",
      token: item.token || slugifyLookup(item.name || item.title || item.path || ""),
      path: item.path || "",
      type: item.type || null,
      score: Number(item.score || 0)
    }));
}

function mergeContextSuggestions(items = []) {
  const merged = new Map();
  for (const item of items) {
    const key = (item.path || `${item.kind}:${item.token || item.name || item.title}`).toLowerCase();
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing || Number(item.score || 0) > Number(existing.score || 0)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
}

function scoreContextSuggestion(item, terms = [], analysis = {}) {
  const fields = getSuggestionSearchFields(item).map((value) => slugifyLookup(value)).filter(Boolean);
  const pathText = slugifyLookup(item.path || "");
  let score = getContextKindBoost(item.kind) + Math.min(Number(item.score || 0) / 10, 18);
  let matchedTerms = 0;

  for (const term of terms) {
    const variants = getContextTermVariants(term);
    const termScore = variants.reduce((best, variant) => {
      if (!variant) return best;
      const fieldScore = fields.reduce((fieldBest, field, index) => {
        if (field === variant) return Math.max(fieldBest, 90 - index);
        if (field.startsWith(variant)) return Math.max(fieldBest, 65 - index);
        if (field.includes(variant)) return Math.max(fieldBest, 42 - index);
        if (variant.includes(field) && field.length > 4) return Math.max(fieldBest, 34 - index);
        return fieldBest;
      }, 0);
      const pathScore = pathText.includes(variant) ? 26 : 0;
      return Math.max(best, fieldScore, pathScore);
    }, 0);
    if (termScore > 0) matchedTerms += 1;
    score += termScore;
  }

  if (matchedTerms > 1) score += matchedTerms * 70;
  if (matchedTerms === terms.length) score += 90;
  score += getIntentContextBoost(item, terms, analysis, fields, pathText);
  return Math.max(0, score);
}

function getIntentContextBoost(item, terms = [], analysis = {}, fields = [], pathText = "") {
  const intents = analysis.intents || new Set();
  const scope = analysis.scope || new Set();
  const normalizedPath = String(item.path || "").replaceAll("\\", "/").toLowerCase();
  const basename = slugifyLookup(path.basename(normalizedPath, ".md"));
  const isFile = item.kind === "file";
  const isSkill = item.kind === "skill" || item.kind === "assistant" || item.kind === "mentor";
  const fieldText = fields.join(" ");
  let boost = 0;

  if (scope.has("personal")) {
    if (isPersonalContextPath(normalizedPath)) boost += isFile ? 90 : 18;
    if (isCareerContextPath(normalizedPath)) boost -= 65;
  }
  if (scope.has("career")) {
    if (isCareerContextPath(normalizedPath)) boost += isFile ? 90 : 18;
    if (isPersonalContextPath(normalizedPath)) boost -= 45;
  }

  if (intents.has("okr")) {
    if (isFile && isOkrContextPath(normalizedPath)) boost += 190;
    if (isFile && /personal-q\d-fy20\d{2}|okr-q\d-fy\d{2}|sprint-state-q\d-fy20\d{2}/i.test(normalizedPath)) boost += 70;
    if (isFile && isSprintContextPath(normalizedPath)) boost += 70;
    if (isSkill) boost += /okr|sprint|planner|manager/.test(fieldText) ? 35 : -180;
  }

  if (intents.has("sprint")) {
    if (isFile && isSprintContextPath(normalizedPath)) boost += 180 + getSprintDateProximityBoost(basename);
    if (isFile && isOkrContextPath(normalizedPath)) boost += 75;
    if (isSkill) boost += /sprint|okr|planner|manager/.test(fieldText) ? 45 : -90;
  }

  if (intents.has("deep-work")) {
    if (isFile && (normalizedPath.includes("/deep-work/") || item.type === "deep-work-session")) boost += 220;
    if (isSkill) boost += /deep-work|focus|planner|manager/.test(fieldText) ? 35 : -80;
  }

  if (intents.has("idea")) {
    if (isFile && normalizedPath.endsWith("2.areas/personal/ideas/idea-ledger.md")) boost += 220;
    if (isFile && normalizedPath.includes("/ideas/")) boost += 110;
    if (isSkill) boost += /idea|evaluator|builder/.test(fieldText) ? 55 : -65;
  }

  if (intents.has("system")) {
    if (isFile && /about-me|personal-system|checklist-state|vision/.test(pathText)) boost += 180;
    if (isSkill) boost += /about-me|curator|system/.test(fieldText) ? 55 : -70;
  }

  if (intents.has("people")) {
    if (item.kind === "people") boost += 160;
    if (isFile && /\/people\//.test(normalizedPath)) boost += 100;
    if (isSkill) boost -= 80;
  }

  if (intents.has("task")) {
    if (isFile && /fleeting|sprint|checklist|personal-system/.test(pathText)) boost += 55;
    if (isSkill) boost += /planner|manager|todo|task/.test(fieldText) ? 45 : -70;
  }

  if (isFile && /\/templates?\//.test(normalizedPath)) boost -= 160;
  if (isFile && /(^|\/)(4\.archive|\.trash)(\/|$)/.test(normalizedPath)) boost -= 200;
  if (isSkill && terms.length && terms.every((term) => term === "personal" || term === "career")) boost -= 70;
  return boost;
}

function isPersonalContextPath(relativePath) {
  return /(^|\/)2\.areas\/personal(\/|$)|(^|\/)3\.resources\/people(\/|$)/i.test(relativePath);
}

function isCareerContextPath(relativePath) {
  return /(^|\/)2\.areas\/career(\/|$)|(^|\/)1\.projects(\/|$)/i.test(relativePath);
}

function isOkrContextPath(relativePath) {
  return /(^|\/)okrs?(\/|$)|okr|objectives?|key-results?/i.test(relativePath);
}

function isSprintContextPath(relativePath) {
  return /(^|\/)sprints?(\/|$)|sprint-state|sprint-plan|sprint-\d{4}-\d{2}-\d{2}/i.test(relativePath);
}

function getSprintDateProximityBoost(basename) {
  const match = String(basename || "").match(/sprint-(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return 0;
  const ageDays = Math.abs(Date.now() - date.getTime()) / 86400000;
  return Math.max(0, 70 - Math.min(ageDays, 70));
}

function getContextTermVariants(term) {
  const clean = slugifyLookup(term);
  const variants = new Set([clean]);
  if (clean.endsWith("s") && clean.length > 3) variants.add(clean.slice(0, -1));
  if (clean === "okr") variants.add("okrs");
  if (clean === "okrs") variants.add("okr");
  return Array.from(variants);
}

function getContextKindBoost(kind) {
  if (kind === "file") return 18;
  if (kind === "people") return 8;
  if (kind === "skill") return 4;
  return 0;
}

async function getReferenceRows(kind) {
  if (kind === "skill") {
    return dbQuery(`
      SELECT note_id, path, title, type, name, content, updated
      FROM notes_metadata
      WHERE LOWER(COALESCE(type, '')) IN ('mentor', 'assistant')
      ORDER BY datetime(updated) DESC
    `);
  }
  if (kind === "mentor" || kind === "assistant") {
    return dbQuery(`
      SELECT note_id, path, title, type, name, content, updated
      FROM notes_metadata
      WHERE LOWER(COALESCE(type, '')) = ${sqlValue(kind)}
      ORDER BY datetime(updated) DESC
    `);
  }
  return dbQuery(`
    SELECT note_id, path, title, type, name, updated
    FROM notes_metadata
    WHERE LOWER(COALESCE(type, '')) = 'people'
      AND (
        path LIKE '2.Areas/Personal/People/%'
        OR path LIKE '3.Resources/People/%'
      )
    ORDER BY datetime(updated) DESC
  `);
}

async function getChatSkills(query = "") {
  await ensureIndexSchema();
  const cleanQuery = normalizeLookupName(query);
  const rows = mergeSkillRows(
    await readVaultSkills(),
    await getReferenceRows("skill")
  );
  const suggestions = rows
    .filter((row) => matchesSuggestionQuery(row, cleanQuery))
    .map((row) => ({ row, score: scoreReferenceSuggestion(row, cleanQuery) }))
    .sort((a, b) => b.score - a.score || suggestionSortValue(a.row).localeCompare(suggestionSortValue(b.row)))
    .map(({ row, score }) => ({
      id: row.note_id || row.id || row.name || row.title,
      kind: "skill",
      title: row.title,
      name: row.name || row.title,
      token: slugifyLookup(row.name || row.title || path.basename(row.path || "", ".md")),
      path: row.path || "",
      type: row.type || null,
      score
    }));
  return { kind: "skill", query: cleanQuery, suggestions };
}

async function readVaultSkills() {
  const root = resolveVaultRelativePath(SKILL_ROOT);
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relativePath = `${SKILL_ROOT}/${entry.name}/SKILL.md`;
    const filePath = resolveVaultRelativePath(relativePath);
    try {
      const markdown = await fs.readFile(filePath, "utf8");
      const stat = await fs.stat(filePath);
      skills.push(parseSkillMarkdown({ relativePath, markdown, stat }));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return skills;
}

function parseSkillMarkdown({ relativePath, markdown, stat }) {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const folderName = skillFolderName(relativePath);
  const name = metadata.name || folderName;
  const title = metadata.title || name || findFirstHeading(body) || path.basename(path.dirname(relativePath));
  const content = markdown.trim();
  return {
    note_id: hash(relativePath),
    id: hash(relativePath),
    kind: "skill",
    path: relativePath,
    title,
    name,
    type: metadata.type || "",
    description: metadata.description || "",
    content,
    updated: stat.mtime.toISOString()
  };
}

function mergeSkillRows(...skillGroups) {
  const merged = [];
  const seen = new Set();
  for (const group of skillGroups) {
    for (const skill of group || []) {
      const key = slugifyLookup(skill.name || skill.title || skill.path || skill.id);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(skill);
    }
  }
  return merged;
}

async function getVaultFileSuggestions(query = "") {
  await ensureIndexSchema();
  const cleanQuery = normalizeLookupName(query);
  const analysis = analyzeContextSuggestionQuery(query);
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, updated
    FROM notes_metadata
    ORDER BY datetime(updated) DESC
    LIMIT 300
  `);
  const suggestions = rows
    .filter((row) => matchesSuggestionQuery(row, cleanQuery))
    .map((row) => {
      const fields = getSuggestionSearchFields(row).map((value) => slugifyLookup(value)).filter(Boolean);
      const item = {
        kind: "file",
        path: row.path,
        title: row.title,
        name: row.name || row.title,
        type: row.type || null,
        score: scoreReferenceSuggestion(row, cleanQuery)
      };
      return {
        row,
        score: item.score + getIntentContextBoost(item, analysis.terms, analysis, fields, slugifyLookup(row.path || ""))
      };
    })
    .sort((a, b) => b.score - a.score || suggestionSortValue(a.row).localeCompare(suggestionSortValue(b.row)))
    .slice(0, 20)
    .map(({ row, score }) => ({
      id: row.note_id,
      kind: "file",
      title: row.title,
      name: row.title,
      token: slugifyLookup(row.title || path.basename(row.path || "", ".md")),
      path: row.path,
      score
    }));
  return { kind: "file", query: cleanQuery, suggestions };
}

async function getFileContexts(names) {
  await ensureIndexSchema();
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, para, project, updated, snippet
    FROM notes_metadata
    ORDER BY datetime(updated) DESC
    LIMIT 500
  `);
  const selectedRows = names
    .map((name) => findContextRow(rows, name))
    .filter(Boolean);
  return hydrateVaultContextRows(selectedRows);
}

function findContextRow(rows, reference) {
  const parsed = normalizeReferenceInput(reference);
  if (!parsed) return null;
  const indexedRow = rows.find((row) => matchesLookup(row, parsed));
  if (indexedRow) return indexedRow;
  if (!parsed.path) return null;
  return {
    note_id: hash(parsed.path),
    path: parsed.path,
    title: parsed.title || path.basename(parsed.path, ".md"),
    type: parsed.kind || null,
    name: parsed.name || parsed.title || path.basename(parsed.path, ".md")
  };
}

async function hydrateVaultContextRows(rows) {
  const hydrated = [];
  for (const row of rows) {
    const context = await readVaultContextRow(row).catch(() => null);
    if (context) hydrated.push(context);
  }
  return hydrated;
}

async function readVaultContextRow(row) {
  if (!row?.path) return null;
  const filePath = resolveVaultRelativePath(row.path);
  const [markdown, stat] = await Promise.all([
    fs.readFile(filePath, "utf8"),
    fs.stat(filePath)
  ]);
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const title = row.title || metadata.title || metadata.name || findFirstHeading(body) || path.basename(row.path, ".md");
  const name = row.name || metadata.name || title;
  return {
    ...row,
    note_id: row.note_id || hash(row.path),
    title,
    name,
    type: row.type || metadata.type || null,
    updated: stat.mtime.toISOString(),
    content: markdown.trim(),
    snippet: clipText(body || markdown, 360)
  };
}

function mergeChatSources(sources) {
  const seen = new Set();
  const merged = [];
  for (const source of sources) {
    if (!source?.path || seen.has(source.path)) continue;
    seen.add(source.path);
    merged.push(source);
  }
  return merged;
}

function normalizeReferenceKind(kind) {
  if (kind === "mentor" || kind === "assistant" || kind === "skill" || kind === "people" || kind === "file") return kind;
  return "";
}

function matchesSuggestionQuery(row, query) {
  if (!query) return true;
  const fields = getSuggestionSearchFields(row).map((value) => slugifyLookup(value)).filter(Boolean);
  if (fields.some((field) => field.includes(query))) return true;
  const terms = getSuggestionQueryTerms(query);
  return terms.length > 1 && terms.every((term) => fields.some((field) => field.includes(term)));
}

function scoreReferenceSuggestion(row, query) {
  if (!query) return getRecencySuggestionScore(row);
  const fields = getSuggestionSearchFields(row).map((value) => slugifyLookup(value)).filter(Boolean);
  let score = fields.reduce((total, field, index) => {
    if (field === query) return total + 100 - index;
    if (field.startsWith(query)) return total + 70 - index;
    if (field.includes(query)) return total + 35 - index;
    return total;
  }, getRecencySuggestionScore(row));
  const terms = getSuggestionQueryTerms(query);
  if (terms.length > 1) {
    let matchedTerms = 0;
    for (const term of terms) {
      const termScore = fields.reduce((best, field, index) => {
        if (field === term) return Math.max(best, 56 - index);
        if (field.startsWith(term)) return Math.max(best, 42 - index);
        if (field.includes(term)) return Math.max(best, 24 - index);
        return best;
      }, 0);
      if (termScore > 0) matchedTerms += 1;
      score += termScore;
    }
    if (matchedTerms === terms.length) score += 60;
  }
  return score;
}

function getSuggestionQueryTerms(query) {
  return String(query || "").split("-").map((term) => term.trim()).filter(Boolean);
}

function getSuggestionSearchFields(row) {
  return [
    row.name,
    row.title,
    path.basename(row.path || "", ".md"),
    skillFolderName(row.path || ""),
    row.description,
    row.path
  ];
}

function getRecencySuggestionScore(row) {
  const updatedMs = Date.parse(row.updated || "");
  if (!Number.isFinite(updatedMs)) return 0;
  const ageDays = Math.max(0, (Date.now() - updatedMs) / 86400000);
  return Math.max(0, 10 - Math.min(ageDays, 10));
}

function suggestionSortValue(row) {
  return slugifyLookup(row.name || row.title || row.path);
}

function matchesLookup(row, lookupName) {
  const reference = normalizeReferenceInput(lookupName) || { lookup: normalizeLookupName(lookupName), path: "" };
  if (reference.path && String(row.path || "").toLowerCase() === reference.path.toLowerCase()) return true;
  const candidates = [
    row.name,
    row.title,
    path.basename(row.path || "", ".md"),
    skillFolderName(row.path || "")
  ];
  const target = slugifyLookup(reference.lookup || reference.name || reference.title || lookupName);
  return candidates.some((candidate) => slugifyLookup(candidate) === target);
}

function skillFolderName(relativePath) {
  const segments = String(relativePath || "").split("/");
  const skillRoot = SKILL_ROOT.split("/");
  return segments[0] === skillRoot[0] && segments[1] === skillRoot[1] ? segments[2] || "" : "";
}

function slugifyLookup(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function retrieveChatSources(message, limit = 6) {
  await ensureIndexSchema();
  const terms = extractSearchTerms(message);
  if (!terms.length) {
    const recent = await dbQuery(`
      SELECT note_id, path, title, type, name, para, project, updated, snippet, content
      FROM notes_metadata
      WHERE LOWER(COALESCE(type, '')) NOT IN ('mentor', 'assistant')
      ORDER BY datetime(updated) DESC
      LIMIT ${Number(limit)}
    `);
    return recent.map((row) => ({ ...row, score: 0, snippet: row.snippet || "" }));
  }

  const conditions = terms
    .map((term) => `LOWER(title || ' ' || path || ' ' || content) LIKE ${sqlValue(`%${escapeLike(term)}%`)} ESCAPE '\\'`)
    .join(" OR ");
  const rows = await dbQuery(`
    SELECT note_id, path, title, type, name, para, project, updated, snippet, content
    FROM notes_metadata
    WHERE LOWER(COALESCE(type, '')) NOT IN ('mentor', 'assistant')
      AND (${conditions})
    ORDER BY datetime(updated) DESC
    LIMIT ${Number(limit) * 6}
  `);

  return rows
    .map((row) => {
      const haystack = `${row.title} ${row.path} ${row.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + countOccurrences(haystack, term), 0);
      return {
        ...row,
        score,
        snippet: makeSearchSnippet(row.content || row.snippet || "", terms)
      };
    })
    .sort((a, b) => b.score - a.score || String(b.updated).localeCompare(String(a.updated)))
    .slice(0, limit);
}

function extractSearchTerms(message) {
  const stopWords = new Set([
    "about", "after", "again", "also", "and", "are", "can", "could", "for", "from", "have", "how",
    "into", "like", "notes", "that", "the", "this", "through", "what", "when", "where", "with", "would"
  ]);
  return Array.from(new Set(
    String(message || "")
      .toLowerCase()
      .replace(/#[a-z0-9_-]+/g, " ")
      .replace(/\/[a-z0-9_-]+/g, " ")
      .replace(/@[a-z0-9_-]+/g, " ")
      .replace(/[^a-z0-9/_-]+/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !stopWords.has(term))
  )).slice(0, 10);
}

async function callDeepSeekChatCompletion({ message, history, sources, mentor, assistant, people, thinkingMode, deepWork }) {
  const prompt = buildChatPrompt({ message, history, sources, mentor, assistant, people, deepWork });
  const model = getDeepSeekModel(thinkingMode);
  const endpoint = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const headers = {
    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (DEEPSEEK_TRAINING_OPT_OUT) {
    headers.opt_out = "training";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildChatInstructions({ mentor, assistant, people, deepWork })
        },
        {
          role: "user",
          content: prompt
        }
      ],
      thinking: { type: thinkingMode },
      ...(thinkingMode === "enabled" ? { reasoning_effort: DEEPSEEK_REASONING_EFFORT } : {})
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || "DeepSeek request failed.");
  }

  return {
    model,
    thinkingMode,
    answer: extractDeepSeekText(data) || "I could not produce a response."
  };
}

async function callDeepSeekCaptureSummary({ category, text }) {
  const endpoint = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const headers = {
    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (DEEPSEEK_TRAINING_OPT_OUT) {
    headers.opt_out = "training";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: DEEPSEEK_REGULAR_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You convert assistant responses into concise Obsidian fleeting-note captures.",
            "Return only one or two plain sentences.",
            "Capture the key concept, decision, or reusable insight.",
            "Do not include markdown bullets, headings, labels, quotes, source links, or commentary.",
            "Keep it under 60 words."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Capture category: ${category}`,
            "",
            "Assistant response:",
            clipText(text, 6000)
          ].join("\n")
        }
      ],
      thinking: { type: "disabled" }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || "DeepSeek capture summary request failed.");
  }

  const summary = normalizeAiCaptureSummary(extractDeepSeekText(data));
  if (!summary) throw httpError(502, "DeepSeek did not return a capture summary.");
  return summary;
}

function normalizeAiCaptureSummary(value) {
  return String(value || "")
    .replace(/^["']|["']$/g, "")
    .replace(/^#+\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^(idea|reflection|thought|log|summary)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function getDeepSeekModel(thinkingMode) {
  return thinkingMode === "enabled" ? DEEPSEEK_THINKING_MODEL : DEEPSEEK_REGULAR_MODEL;
}

function buildChatInstructions({ mentor, assistant, people, deepWork }) {
  const mentorLine = mentor
    ? `${mentor.autoSelected ? "A mentor perspective was automatically selected" : "Use this mentor perspective when helpful"}: ${mentor.title || mentor.name || "mentor"}.`
    : "Use your default PKM thinking style.";
  const assistantLine = assistant
    ? `${assistant.autoSelected ? "An assistant skill was automatically selected" : "Apply this assistant skill when helpful"}: ${assistant.title || assistant.name || "assistant"}.`
    : "No assistant skill is selected.";
  const peopleLine = people?.length
    ? "Use selected people notes as relationship/context memory; do not overstate uncertain or inferred facts."
    : "No people notes are selected.";
  return [
    "You are a local-first PKM thinking assistant for an Obsidian Markdown vault.",
    "Use retrieved vault context when it is relevant, but do not pretend it contains facts it does not contain.",
    "Be concise, practical, and transparent. If context is weak or missing, say so.",
    "Do not claim to have written or changed vault files.",
    deepWork?.enabled ? "Deep Work mode is active: stay focused on the user's stated goal, bias recommendations toward it, and avoid unrelated tangents unless asked." : "Deep Work mode is not active.",
    mentorLine,
    assistantLine,
    peopleLine
  ].join(" ");
}

function buildChatPrompt({ message, history, sources, mentor, assistant, people, deepWork }) {
  const historyText = history.length
    ? history.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join("\n\n")
    : "No prior messages in this browser session.";
  const mentorText = mentor
    ? `Mentor note (${mentor.path}):\n${clipText(mentor.content, 1800)}`
    : "No mentor selected.";
  const assistantText = assistant
    ? `Assistant skill (${assistant.path}):\n${clipText(assistant.content, 2200)}`
    : "No assistant selected.";
  const peopleText = people?.length
    ? people.map((person) => `Person note (${person.path}):\n${clipText(person.content, 1400)}`).join("\n\n")
    : "No people selected.";
  const sourceText = sources.length
    ? sources.map((source, index) => [
      `[${index + 1}] ${source.title} (${source.path})`,
      clipText(source.snippet || source.content, 1000)
    ].join("\n")).join("\n\n")
    : "No relevant indexed notes were found.";

  return [
    "Deep Work:",
    deepWork?.enabled ? `Goal: ${deepWork.goal}` : "Not active.",
    "",
    "Recent conversation:",
    historyText,
    "",
    "Mentor:",
    mentorText,
    "",
    "Assistant:",
    assistantText,
    "",
    "People:",
    peopleText,
    "",
    "Relevant vault notes:",
    sourceText,
    "",
    "User question:",
    message
  ].join("\n");
}

function extractDeepSeekText(data) {
  return (data.choices || [])
    .map((choice) => choice.message?.content || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractOpenAiCompatibleText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const choicesText = (data?.choices || [])
    .map((choice) => {
      const content = choice.message?.content ?? choice.delta?.content ?? choice.text ?? "";
      if (Array.isArray(content)) {
        return content.map((part) => part.text || part.content || "").join("");
      }
      return String(content || "");
    })
    .filter(Boolean)
    .join("\n")
    .trim();
  if (choicesText) return choicesText;
  const outputText = (data?.output || [])
    .flatMap((item) => Array.isArray(item.content) ? item.content : [item])
    .map((part) => part.text || part.content || "")
    .filter(Boolean)
    .join("\n")
    .trim();
  return outputText;
}

function formatChatSource(source) {
  return {
    id: source.note_id,
    title: source.title,
    path: source.path,
    para: source.para || null,
    project: source.project || null,
    updated: source.updated,
    snippet: clipText(source.snippet || source.content || "", 360),
    score: Number(source.score || 0)
  };
}

function formatContextSource(mentor) {
  return {
    id: mentor.note_id,
    title: mentor.title,
    type: mentor.type || null,
    name: mentor.name || null,
    path: mentor.path,
    autoSelected: Boolean(mentor.autoSelected)
  };
}

function clipText(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

async function getDashboard() {
  await ensureIndexSchema();
  const [status, personalSystem, habitDashboard, deepWork] = await Promise.all([
    getIndexStatus(),
    getPersonalSystemDashboard(),
    getHabitDashboard(),
    listDeepWorkSessions(5)
  ]);
  const dueSoonCutoff = addDays(new Date(), 7);
  const taskSummary = await dbQuery(`
    SELECT
      COUNT(*) AS open_count,
      SUM(CASE WHEN path LIKE '2.Areas/Career/%' OR path LIKE '1.Projects/%' THEN 1 ELSE 0 END) AS work_count,
      SUM(CASE WHEN path LIKE '2.Areas/Personal/%' OR path LIKE '1.Projects/columbus/%' THEN 1 ELSE 0 END) AS personal_count,
      SUM(CASE WHEN COALESCE(due, '') <> '' THEN 1 ELSE 0 END) AS due_count,
      SUM(CASE WHEN COALESCE(due, '') <> '' AND date(due) <= date(${sqlValue(formatDate(dueSoonCutoff))}) THEN 1 ELSE 0 END) AS due_soon_count,
      SUM(CASE WHEN LOWER(COALESCE(priority, '')) = 'high'
        OR (LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'true')
        THEN 1 ELSE 0 END) AS high_count,
      SUM(CASE WHEN LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'true' THEN 1 ELSE 0 END) AS do_now_count,
      SUM(CASE WHEN LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'false' THEN 1 ELSE 0 END) AS schedule_count,
      SUM(CASE WHEN LOWER(COALESCE(important, '')) = 'false' AND LOWER(COALESCE(urgent, '')) = 'true' THEN 1 ELSE 0 END) AS quick_count,
      SUM(CASE WHEN LOWER(COALESCE(important, '')) = 'false' AND LOWER(COALESCE(urgent, '')) = 'false' THEN 1 ELSE 0 END) AS someday_count,
      SUM(CASE WHEN COALESCE(important, '') = '' AND COALESCE(urgent, '') = '' THEN 1 ELSE 0 END) AS triage_count
    FROM tasks
    WHERE status = 'open'
  `);

  return {
    index: status,
    taskSummary: normalizeTaskSummary(taskSummary[0] || {}),
    personalSystem,
    habits: habitDashboard,
    deepWork
  };
}

async function getHabitDashboard() {
  try {
    const selectedSprint = await resolvePersonalSprintStatePath("current");
    const sprintMarkdown = await readVaultMarkdownFile(selectedSprint.path, "No active sprint found.");
    const { frontmatter: sprintFrontmatter } = splitFrontmatter(sprintMarkdown);
    const sprintMeta = parseSprintFrontmatter(sprintFrontmatter);
    if (!sprintMeta.okrFile) return {
      available: false,
      message: "Current sprint does not point to an OKR file.",
      items: []
    };

    const okrPath = normalizeVaultRelativeMarkdownPath(sprintMeta.okrFile);
    const okrMarkdown = await readVaultMarkdownFile(okrPath, `OKR file not found: ${okrPath}`);
    const { frontmatter: okrFrontmatter, body: okrBody } = splitFrontmatter(okrMarkdown);
    const okrMeta = parseOkrFrontmatter(okrFrontmatter);
    const identity = extractOkrIdentity(okrBody);
    const quarterRange = getOkrQuarterRange(okrMeta, sprintMeta);
    const habitKrs = okrMeta.keyResults.filter((kr) => isTrackedHabitKr(kr));
    const today = getTodayIsoDate();
    const currentWeekStart = getIsoWeekStart(today);
    const currentWeekEnd = addDaysToIsoDate(currentWeekStart, 6);
    const items = [];

    for (const kr of habitKrs) {
      const counts = await countHabitActivityDates({
        activity: kr.activity,
        start: quarterRange.start,
        end: quarterRange.end
      });
      const weekCount = counts.dates.filter((date) => date >= currentWeekStart && date <= currentWeekEnd).length;
      const todayDone = counts.dates.includes(today);
      const weeklyTarget = getHabitWeeklyTarget(kr);
      const cadence = kr.cadence || (kr.type === "frequency" ? "weekly" : "daily");
      const periods = getHabitConsistencyPeriods({
        activityDates: counts.dates,
        start: quarterRange.start,
        end: quarterRange.end,
        today,
        cadence,
        weeklyTarget
      });
      const status = getHabitStatus({ kr, todayDone, weekCount, weeklyTarget });
      items.push({
        id: kr.id,
        objective: kr.objective,
        objectiveTitle: kr.objectiveTitle,
        description: kr.description,
        activity: kr.activity,
        domain: kr.domain,
        cadence,
        type: kr.type,
        target: weeklyTarget,
        unit: kr.unit,
        todayDone,
        weekCount,
        periods,
        quarterDays: counts.dates.length,
        quarterLogs: counts.totalLogs,
        streak: cadence === "weekly" ? getWeeklyHabitStreak(periods.weeks) : getActivityStreak(counts.dates, today),
        streakUnit: cadence === "weekly" ? "week" : "day",
        status,
        statusLabel: formatHabitStatusLabel(status, { todayDone, weekCount, weeklyTarget })
      });
    }

    return {
      available: true,
      okrPath,
      quarter: okrMeta.quarter || sprintMeta.quarter || "",
      start: quarterRange.start,
      end: quarterRange.end,
      today,
      currentWeekStart,
      currentWeekEnd,
      count: items.length,
      attentionCount: items.filter((item) => item.status !== "current").length,
      identity,
      items
    };
  } catch (error) {
    return {
      available: false,
      message: error.statusCode === 404 ? error.message : "Habit tracking is unavailable.",
      items: []
    };
  }
}

async function getPersonalSystemDashboard() {
  const checklistItems = [
    {
      key: "last-fleeting-classification",
      label: "Fleeting classification",
      cadence: "Biweekly",
      overdueAfterDays: 21,
      actionPrompt: "classify my fleeting notes"
    },
    {
      key: "last-biweekly-priority",
      label: "Sprint priority",
      cadence: "Biweekly",
      overdueAfterDays: 21,
      actionPrompt: "what's my personal priority this sprint?"
    },
    {
      key: "last-monthly-drift-check",
      label: "Monthly drift check",
      cadence: "Monthly",
      overdueAfterDays: 35,
      actionPrompt: "monthly drift check"
    },
    {
      key: "last-monthly-curation",
      label: "Monthly curation",
      cadence: "Monthly",
      overdueAfterDays: 35,
      actionPrompt: "review my fleeting notes"
    },
    {
      key: "last-vision-review",
      label: "Vision review",
      cadence: "Quarterly",
      overdueAfterDays: 100,
      actionPrompt: "review my vision"
    },
    {
      key: "last-okr-scoring",
      label: "OKR scoring",
      cadence: "Quarterly",
      overdueAfterDays: 100,
      actionPrompt: "score my personal OKRs"
    }
  ];
  const statePath = PERSONAL_CHECKLIST_STATE_PATH;
  const systemPath = PERSONAL_SYSTEM_PATH;
  const markdown = await readFileIfExists(resolveVaultRelativePath(statePath));
  if (!markdown.trim()) {
    return {
      available: false,
      statePath,
      systemPath,
      attentionCount: 0,
      currentCount: 0,
      items: [],
      message: "Checklist state note not found."
    };
  }

  const { frontmatter } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const today = getTodayIsoDate();
  const items = checklistItems.map((item) => {
    const lastRun = normalizeIsoDate(metadata[item.key]);
    const daysSinceRun = lastRun ? daysBetweenIsoDates(lastRun, today) : null;
    const status = !lastRun
      ? "not-run"
      : daysSinceRun > item.overdueAfterDays ? "overdue" : "current";
    return {
      ...item,
      lastRun,
      daysSinceRun,
      status
    };
  });

  return {
    available: true,
    statePath,
    systemPath,
    attentionCount: items.filter((item) => item.status !== "current").length,
    currentCount: items.filter((item) => item.status === "current").length,
    items
  };
}

async function getPersonalSprint(view = "") {
  const selectedSprint = await resolvePersonalSprintStatePath(view);
  const sprintMarkdown = await readVaultMarkdownFile(selectedSprint.path, "No active sprint — run personal sprint planning.");
  const { frontmatter: sprintFrontmatter, body: sprintBody } = splitFrontmatter(sprintMarkdown);
  const sprintMeta = parseSprintFrontmatter(sprintFrontmatter);
  if (!sprintMeta.okrFile) throw httpError(404, "OKR file not found in sprint-state frontmatter.");
  const okrPath = normalizeVaultRelativeMarkdownPath(sprintMeta.okrFile);

  const okrMarkdown = await readVaultMarkdownFile(okrPath, `OKR file not found: ${okrPath}`);
  const { frontmatter: okrFrontmatter, body: okrBody } = splitFrontmatter(okrMarkdown);
  const okrMeta = parseOkrFrontmatter(okrFrontmatter);
  const identity = extractOkrIdentity(okrBody);
  const activities = Array.from(new Set([
    sprintMeta.activeKrActivity,
    ...okrMeta.keyResults.map((kr) => kr.activity)
  ].filter(Boolean)));
  const activityCounts = await countSprintActivities({
    activities,
    sprintStart: sprintMeta.sprintStart,
    sprintEnd: sprintMeta.sprintEnd
  });
  const today = getTodayIsoDate();
  const currentWeekStart = getIsoWeekStart(today);
  const currentWeekEnd = addDaysToIsoDate(currentWeekStart, 6);
  const isStale = Boolean(sprintMeta.sprintEnd && today > sprintMeta.sprintEnd);
  const activeKr = okrMeta.keyResults.find((kr) => kr.id === sprintMeta.activeKr) || null;
  const dailyFocus = getPersonalDailyFocus(sprintBody, today, selectedSprint.path);
  const focus = await getPersonalFocusIdea();
  const activeKrCounts = activityCounts[sprintMeta.activeKrActivity || activeKr?.activity] || { sprintCount: 0, weekCount: 0 };
  const activeProgress = getPersonalKrProgress(activeKr || {
    type: sprintMeta.activeKrType,
    activity: sprintMeta.activeKrActivity,
    status: sprintMeta.status
  }, activeKrCounts, {
    sprintStart: sprintMeta.sprintStart,
    sprintEnd: sprintMeta.sprintEnd
  });

  return {
    sprint: {
      path: selectedSprint.path,
      view: selectedSprint.view,
      selection: selectedSprint.selection,
      candidateCount: selectedSprint.candidateCount,
      availableViews: selectedSprint.availableViews,
      title: sprintMeta.title || "Personal Sprint",
      quarter: sprintMeta.quarter || okrMeta.quarter || "",
      start: sprintMeta.sprintStart,
      end: sprintMeta.sprintEnd,
      activeKr: sprintMeta.activeKr,
      activeKrDescription: sprintMeta.activeKrDescription,
      activeKrType: sprintMeta.activeKrType,
      activeKrActivity: sprintMeta.activeKrActivity,
      activeActivityCount: activityCounts[sprintMeta.activeKrActivity]?.sprintCount || 0,
      activeProgress,
      review: buildSprintReview({ sprintMeta, activeKr, activityCounts, today }),
      preview: buildSprintPreview({ sprintMeta, today }),
      isCurrent: Boolean(sprintMeta.sprintStart && sprintMeta.sprintEnd && today >= sprintMeta.sprintStart && today <= sprintMeta.sprintEnd),
      isStale,
      staleMessage: isStale ? `Sprint ended ${sprintMeta.sprintEnd}. Run personal sprint planning.` : "",
      currentWeekStart,
      currentWeekEnd,
      weeklyCheckboxes: sprintMeta.weeklyCheckboxes.map((item) => ({
        ...item,
        isCurrentWeek: Boolean(item.week && item.week >= currentWeekStart && item.week <= currentWeekEnd)
      })),
      okrFile: okrPath
    },
    okr: {
      path: okrPath,
      title: okrMeta.title || "Personal OKRs",
      quarter: okrMeta.quarter || sprintMeta.quarter || "",
      status: okrMeta.status || "",
      identity,
      objectives: groupPersonalOkrObjectives({
        keyResults: okrMeta.keyResults,
        activeKr: sprintMeta.activeKr,
        activityCounts,
        sprintStart: sprintMeta.sprintStart,
        sprintEnd: sprintMeta.sprintEnd
      })
    },
    dailyFocus,
    focus
  };
}

async function updatePersonalSprintCheckbox(body = {}) {
  const week = normalizeIsoDate(body?.week);
  if (!week) throw httpError(400, "Week is required.");
  const done = Boolean(body?.done);
  const selectedSprint = await resolvePersonalSprintStatePath(body?.view || "");
  const filePath = resolveVaultRelativePath(selectedSprint.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const { frontmatter, body: markdownBody } = splitFrontmatter(markdown);
  const sprintMeta = parseSprintFrontmatter(frontmatter);
  if (!sprintMeta.weeklyCheckboxes.some((item) => item.week === week)) {
    throw httpError(404, "Sprint checkbox week was not found.");
  }
  const nextFrontmatter = updateWeeklyCheckboxesFrontmatter(frontmatter, week, done);
  await fs.writeFile(filePath, `---\n${nextFrontmatter.trimEnd()}\n---\n${markdownBody}`, "utf8");
  return await getPersonalSprint(selectedSprint.view);
}

async function updatePersonalSprintDailyFocus(body = {}) {
  const text = String(body?.text || "").trim();
  if (text.length > 600) throw httpError(400, "Daily focus must be 600 characters or less.");
  const selectedSprint = await resolvePersonalSprintStatePath(body?.view || "");
  const filePath = resolveVaultRelativePath(selectedSprint.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const { frontmatter, body: markdownBody } = splitFrontmatter(markdown);
  const today = getTodayIsoDate();
  const nextBody = updateDailyFocusMarkdown(markdownBody, {
    date: today,
    text,
    source: body?.source || "webapp"
  });
  await fs.writeFile(filePath, `---\n${frontmatter.trimEnd()}\n---\n${nextBody}`, "utf8");
  return await getPersonalSprint(selectedSprint.view);
}

async function resolvePersonalSprintStatePath(view = "") {
  if (PERSONAL_SPRINT_STATE_PATH) {
    return {
      path: PERSONAL_SPRINT_STATE_PATH,
      view: "current",
      selection: "configured",
      candidateCount: 1,
      availableViews: [{ view: "current", label: "Current", path: PERSONAL_SPRINT_STATE_PATH }]
    };
  }

  const today = getTodayIsoDate();
  const candidates = await discoverPersonalSprintStateFiles();
  if (!candidates.length) {
    throw httpError(404, `No personal sprint files found under ${PERSONAL_OKR_ROOT}.`);
  }

  const active = candidates
    .filter((candidate) => candidate.meta.sprintStart && candidate.meta.sprintEnd && today >= candidate.meta.sprintStart && today <= candidate.meta.sprintEnd)
    .sort((a, b) => compareIsoDesc(a.meta.sprintStart, b.meta.sprintStart))[0];

  const upcoming = candidates
    .filter((candidate) => candidate.meta.sprintStart && candidate.meta.sprintStart > today)
    .sort((a, b) => compareIsoAsc(a.meta.sprintStart, b.meta.sprintStart))[0];

  const recent = candidates
    .filter((candidate) => candidate.meta.sprintEnd && candidate.meta.sprintEnd < today)
    .sort((a, b) => compareIsoDesc(a.meta.sprintEnd, b.meta.sprintEnd))[0];

  const slots = {
    last: recent ? { ...recent, view: "last", selection: "last-by-date" } : null,
    current: active ? { ...active, view: "current", selection: "active-by-date" } : null,
    next: upcoming ? { ...upcoming, view: "next", selection: "next-by-date" } : null
  };
  const availableViews = [
    slots.last ? buildSprintViewSummary(slots.last, "Last") : null,
    slots.current ? buildSprintViewSummary(slots.current, "Current") : null,
    slots.next ? buildSprintViewSummary(slots.next, "Next") : null
  ].filter(Boolean);
  const requestedView = ["last", "current", "next"].includes(String(view || "")) ? String(view) : "";
  const selected = (requestedView && slots[requestedView])
    || slots.current
    || slots.next
    || slots.last;

  if (selected) {
    return {
      ...selected,
      candidateCount: candidates.length,
      availableViews
    };
  }

  const fallback = candidates.sort((a, b) => b.updatedMs - a.updatedMs)[0];
  return {
    ...fallback,
    view: "current",
    selection: "latest-file",
    candidateCount: candidates.length,
    availableViews: [buildSprintViewSummary({ ...fallback, view: "current" }, "Current")]
  };
}

function buildSprintViewSummary(candidate, label) {
  return {
    view: candidate.view,
    label,
    path: candidate.path,
    start: candidate.meta.sprintStart,
    end: candidate.meta.sprintEnd,
    quarter: candidate.meta.quarter,
    activeKr: candidate.meta.activeKr
  };
}

async function discoverPersonalSprintStateFiles() {
  const root = resolveVaultRelativePath(PERSONAL_OKR_ROOT);
  const files = [];
  await collectPersonalSprintMarkdownFiles(root, files);
  const candidates = [];

  for (const filePath of files) {
    const markdown = await fs.readFile(filePath, "utf8");
    const stat = await fs.stat(filePath);
    const { frontmatter } = splitFrontmatter(markdown);
    const meta = parseSprintFrontmatter(frontmatter);
    if (!meta.okrFile && !meta.sprintStart && !meta.sprintEnd) continue;
    candidates.push({
      path: toVaultPath(filePath),
      meta,
      updatedMs: stat.mtimeMs
    });
  }

  return candidates;
}

async function collectPersonalSprintMarkdownFiles(dirPath, files) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectPersonalSprintMarkdownFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && isPersonalSprintMarkdownName(entry.name)) {
      files.push(fullPath);
    }
  }
}

function isPersonalSprintMarkdownName(fileName) {
  return /^sprint-\d{4}-\d{2}-\d{2}\.md$/i.test(fileName)
    || /^sprint-state.*\.md$/i.test(fileName);
}

function compareIsoAsc(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function compareIsoDesc(left, right) {
  return compareIsoAsc(right, left);
}

async function readVaultMarkdownFile(relativePath, notFoundMessage) {
  try {
    return await fs.readFile(resolveVaultRelativePath(relativePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw httpError(404, notFoundMessage);
    throw error;
  }
}

function parseSprintFrontmatter(frontmatter) {
  const scalar = parseFrontmatter(frontmatter);
  return {
    title: scalar.title || "",
    quarter: scalar.quarter || "",
    sprintStart: normalizeIsoDate(scalar["sprint-start"]),
    sprintEnd: normalizeIsoDate(scalar["sprint-end"]),
    activeKr: scalar["active-kr"] || "",
    activeKrDescription: scalar["active-kr-description"] || "",
    activeKrType: scalar["active-kr-type"] || "",
    activeKrActivity: scalar["active-kr-activity"] || "",
    okrFile: scalar["okr-file"] || "",
    weeklyCheckboxes: parseYamlObjectArray(frontmatter, "weekly-checkboxes").map((item) => ({
      week: normalizeIsoDate(item.week),
      label: item.label || `Week of ${normalizeIsoDate(item.week)}`,
      done: parseYamlBoolean(item.done)
    })).filter((item) => item.week)
  };
}

function parseOkrFrontmatter(frontmatter) {
  const scalar = parseFrontmatter(frontmatter);
  return {
    title: scalar.title || "",
    quarter: scalar.quarter || "",
    quarterStart: normalizeIsoDate(scalar["quarter-start"]),
    quarterEnd: normalizeIsoDate(scalar["quarter-end"]),
    status: scalar.status || "",
    keyResults: parseYamlObjectArray(frontmatter, "key-results").map((item) => ({
      id: item.id || "",
      objective: Number(item.objective || 0),
      objectiveTitle: item["objective-title"] || "",
      description: item.description || "",
      type: item.type || "",
      target: item.target ? Number(item.target) : null,
      weeklyTarget: item["weekly-target"] ? Number(item["weekly-target"]) : null,
      unit: item.unit || "",
      activity: item.activity || "",
      habit: parseYamlBoolean(item.habit),
      cadence: item.cadence || "",
      domain: item.domain || "",
      status: item.status || "",
      score: item.score || "",
      due: normalizeIsoDate(item.due),
      nextDue: normalizeIsoDate(item["next-due"])
    })).filter((item) => item.id)
  };
}

function extractOkrIdentity(markdownBody) {
  const section = extractMarkdownHeadingSection(markdownBody, "Identity", 1);
  const text = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^>\s*/, ""))
    .join("\n")
    .trim();
  return {
    available: Boolean(text),
    text
  };
}

function parseYamlObjectArray(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return [];
  const items = [];
  let current = null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) break;
    const itemStart = line.match(/^\s{2}-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (itemStart) {
      current = {};
      current[itemStart[1]] = parseYamlScalarValue(itemStart[2]);
      items.push(current);
      continue;
    }
    const property = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (property && current) current[property[1]] = parseYamlScalarValue(property[2]);
  }
  return items;
}

function parseYamlScalarValue(value) {
  const clean = String(value || "").trim();
  return clean ? clean.replace(/^["']|["']$/g, "") : "";
}

function parseYamlBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function updateWeeklyCheckboxesFrontmatter(frontmatter, week, done) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "weekly-checkboxes:");
  if (start === -1) throw httpError(400, "weekly-checkboxes frontmatter was not found.");
  let currentWeek = "";
  let changed = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) break;
    const weekMatch = line.match(/^\s+(?:-\s*)?week:\s*(.*)$/);
    if (weekMatch) {
      currentWeek = normalizeIsoDate(parseYamlScalarValue(weekMatch[1]));
      continue;
    }
    if (currentWeek === week && /^\s+done:\s*/.test(line)) {
      lines[index] = line.replace(/done:\s*.*/, `done: ${done ? "true" : "false"}`);
      changed = true;
      break;
    }
  }
  if (!changed) throw httpError(404, "Sprint checkbox done field was not found.");
  return lines.join("\n");
}

function getPersonalDailyFocus(markdownBody, date = formatDate(new Date()), sprintPath = "") {
  const section = extractMarkdownSection(markdownBody, "Daily Focus");
  const entries = section
    .split(/\r?\n/)
    .map(parseDailyFocusLine)
    .filter(Boolean);
  let todayEntry = null;
  for (const entry of entries) {
    if (entry.date === date) todayEntry = entry;
  }
  return {
    path: sprintPath,
    date,
    text: todayEntry?.text || "",
    source: todayEntry?.source || "",
    available: Boolean(todayEntry?.text),
    sectionExists: Boolean(section.trim())
  };
}

function parseDailyFocusLine(line) {
  const clean = String(line || "").trim();
  if (!clean.startsWith("-")) return null;
  const date = normalizeIsoDate(clean.match(/\[date::\s*([^\]]+)]/i)?.[1]);
  const focus = clean.match(/\[focus::\s*([^\]]+)]/i)?.[1]?.trim() || "";
  const source = clean.match(/\[source::\s*([^\]]+)]/i)?.[1]?.trim() || "";
  if (date && focus) return { date, text: focus, source };

  const fallback = clean.match(/^-\s*(\d{4}-\d{2}-\d{2})\s*(?::|-|\u2014)\s*(.+)$/);
  if (!fallback) return null;
  return {
    date: normalizeIsoDate(fallback[1]),
    text: stripMarkdown(fallback[2]),
    source: "vault"
  };
}

function updateDailyFocusMarkdown(markdownBody, { date, text, source = "webapp" } = {}) {
  const normalizedDate = normalizeIsoDate(date);
  if (!normalizedDate) throw httpError(400, "Daily focus date is required.");
  const safeText = sanitizeInlineFieldValue(text);
  const safeSource = sanitizeInlineFieldValue(source || "webapp");
  const nextLine = `- [date:: ${normalizedDate}] [focus:: ${safeText}] [source:: ${safeSource}]`;
  const original = String(markdownBody || "");
  const lines = original.replace(/\s*$/, "\n").split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+)$/);
    return match && stripMarkdown(match[1]).toLowerCase() === "daily focus";
  });

  if (start < 0) {
    if (!safeText) return original;
    return `${original.trimEnd()}\n\n## Daily Focus\n\n${nextLine}\n`;
  }

  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const sectionEnd = end < 0 ? lines.length : end;
  let changed = false;
  const nextLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (index <= start || index >= sectionEnd) {
      nextLines.push(lines[index]);
      continue;
    }
    const parsed = parseDailyFocusLine(lines[index]);
    if (parsed?.date !== normalizedDate) {
      nextLines.push(lines[index]);
      continue;
    }
    if (changed || !safeText) {
      changed = true;
      continue;
    }
    nextLines.push(nextLine);
    changed = true;
  }

  if (safeText && !changed) {
    let insertAt = start + 1;
    while (insertAt < sectionEnd && nextLines[insertAt]?.trim() === "") insertAt += 1;
    nextLines.splice(insertAt, 0, nextLine);
  }

  return `${nextLines.join("\n").trimEnd()}\n`;
}

function sanitizeInlineFieldValue(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .replaceAll("]", ")")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPersonalFocusIdea() {
  const ledgerPath = PERSONAL_IDEA_LEDGER_PATH;
  const markdown = await readFileIfExists(resolveVaultRelativePath(ledgerPath));
  if (!markdown.trim()) {
    return {
      ledgerPath,
      title: "",
      doneLooksLike: "",
      started: "",
      ideaPath: "",
      available: false
    };
  }

  const activeSection = extractMarkdownSection(markdown, "Active (1 slot only)");
  const table = parseMarkdownTable(activeSection);
  const row = table.rows[0] || null;
  if (!row) {
    return {
      ledgerPath,
      title: "",
      doneLooksLike: "",
      started: "",
      ideaPath: "",
      available: false
    };
  }

  const ideaIndex = getMarkdownTableColumnIndex(table.headers, ["idea"], 0);
  const doneLooksLikeIndex = getMarkdownTableColumnIndex(table.headers, ["done looks like"], 1);
  const startedIndex = getMarkdownTableColumnIndex(table.headers, ["started", "reviewing since"], 2);
  const ideaCell = row[ideaIndex] || "";
  const link = ideaCell.match(/\[([^\]]+)]\(([^)]+)\)/);
  const title = stripMarkdown(link?.[1] || ideaCell);
  if (isOpenIdeaSlot(title)) {
    return {
      ledgerPath,
      title: "",
      doneLooksLike: "",
      started: "",
      ideaPath: "",
      available: false
    };
  }
  const ideaPath = link?.[2] ? await resolveIdeaLedgerLink(link[2]) : "";
  return {
    ledgerPath,
    title,
    doneLooksLike: stripMarkdown(row[doneLooksLikeIndex] || ""),
    started: stripMarkdown(row[startedIndex] || ""),
    ideaPath,
    available: Boolean(title)
  };
}

function isOpenIdeaSlot(value) {
  return /^(slot open|open|none|n\/a|-)$/i.test(stripMarkdown(value));
}

function extractMarkdownSection(markdown, headingText) {
  const lines = String(markdown || "").split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+)$/);
    return match && stripMarkdown(match[1]).includes(headingText);
  });
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n");
}

function extractMarkdownHeadingSection(markdown, headingText, level = 1) {
  const lines = String(markdown || "").split(/\r?\n/);
  const headingPattern = new RegExp(`^#{${level}}\\s+(.+)$`);
  const start = lines.findIndex((line) => {
    const match = line.match(headingPattern);
    return match && stripMarkdown(match[1]).toLowerCase() === String(headingText || "").toLowerCase();
  });
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    const match = line.match(/^(#{1,6})\s+/);
    return match && match[1].length <= level;
  });
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n");
}

function parseMarkdownTableRows(markdown) {
  return parseMarkdownTable(markdown).rows;
}

function parseMarkdownTable(markdown) {
  const rows = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2);
  const headers = rows[0]?.map((cell) => stripMarkdown(cell).toLowerCase()) || [];
  const dataRows = rows.filter((cells, index) => index !== 0 || !/^idea$/i.test(stripMarkdown(cells[0])));
  return { headers, rows: dataRows };
}

function getMarkdownTableColumnIndex(headers = [], names = [], fallback = 0) {
  const index = headers.findIndex((header) => names.some((name) => header === name));
  return index >= 0 ? index : fallback;
}

async function resolveIdeaLedgerLink(link) {
  const clean = String(link || "").trim().split("#")[0].replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean || /^https?:\/\//i.test(clean)) return "";
  const withExtension = clean.endsWith(".md") ? clean : `${clean}.md`;
  const baseDir = path.posix.dirname(PERSONAL_IDEA_LEDGER_PATH);
  const candidates = [
    path.posix.normalize(path.posix.join(baseDir, withExtension)),
    path.posix.normalize(path.posix.join(baseDir, withExtension.replace(/^Ideas\//i, ""))),
    path.posix.normalize(path.posix.join("2.Areas/Personal/Ideas", withExtension.replace(/^Ideas\//i, "")))
  ];
  for (const candidate of Array.from(new Set(candidates))) {
    try {
      await fs.access(resolveVaultRelativePath(candidate));
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return candidates[0];
}

function groupPersonalOkrObjectives({ keyResults, activeKr, activityCounts, sprintStart = "", sprintEnd = "" }) {
  const grouped = new Map();
  for (const kr of keyResults) {
    const objectiveId = kr.objective || 0;
    if (!grouped.has(objectiveId)) {
      grouped.set(objectiveId, {
        id: objectiveId,
        title: kr.objectiveTitle || `Objective ${objectiveId}`,
        active: false,
        keyResults: []
      });
    }
    const counts = activityCounts[kr.activity] || { sprintCount: 0, weekCount: 0 };
    const nextKr = {
      ...kr,
      isActive: kr.id === activeKr,
      progress: getPersonalKrProgress(kr, counts, { sprintStart, sprintEnd })
    };
    const objective = grouped.get(objectiveId);
    objective.active = objective.active || nextKr.isActive;
    objective.keyResults.push(nextKr);
  }
  return Array.from(grouped.values()).sort((a, b) => a.id - b.id);
}

function getPersonalKrProgress(kr = {}, counts = {}, { sprintStart = "", sprintEnd = "" } = {}) {
  const done = String(kr.status || "").toLowerCase() === "done";
  if (kr.type === "milestone") {
    return {
      kind: "milestone",
      done,
      current: done ? 1 : 0,
      target: 1,
      percent: done ? 100 : 0,
      label: done ? "Done" : "Not done"
    };
  }
  if (kr.type === "frequency") {
    const target = Number(kr.target || 0);
    const current = Number(counts.weekCount || 0);
    return {
      kind: "frequency",
      current,
      target,
      percent: getProgressPercent(current, target),
      label: `${current}/${target || 0} this week`,
      dots: target ? Array.from({ length: Math.min(target, 8) }, (_, index) => index < counts.weekCount) : []
    };
  }
  const current = Number(counts.sprintCount || 0);
  const target = getInclusiveIsoDateCount(sprintStart, sprintEnd);
  return {
    kind: "habit",
    count: current,
    current,
    target,
    percent: getProgressPercent(current, target),
    label: target ? `${current}/${target} days logged` : `${current} log${current === 1 ? "" : "s"} this sprint`
  };
}

function isTrackedHabitKr(kr = {}) {
  return Boolean(kr.activity && (kr.habit === true || kr.type === "habit"));
}

function getOkrQuarterRange(okrMeta = {}, sprintMeta = {}) {
  if (okrMeta.quarterStart && okrMeta.quarterEnd) {
    return { start: okrMeta.quarterStart, end: okrMeta.quarterEnd };
  }
  const inferred = inferQuarterRange(okrMeta.quarter || sprintMeta.quarter || "");
  if (inferred.start && inferred.end) return inferred;
  return {
    start: sprintMeta.sprintStart || formatDate(new Date()),
    end: sprintMeta.sprintEnd || formatDate(new Date())
  };
}

function inferQuarterRange(quarter = "") {
  const match = String(quarter || "").match(/^Q([1-4])-FY(\d{4})$/i);
  if (!match) return { start: "", end: "" };
  const q = Number(match[1]);
  const fy = Number(match[2]);
  const startYear = q === 4 ? fy : fy - 1;
  const ranges = {
    1: [`${fy - 1}-04-15`, `${fy - 1}-07-14`],
    2: [`${fy - 1}-07-15`, `${fy - 1}-10-14`],
    3: [`${fy - 1}-10-15`, `${fy}-01-14`],
    4: [`${startYear}-01-15`, `${fy}-04-14`]
  };
  const [start, end] = ranges[q] || ["", ""];
  return { start, end };
}

function getHabitWeeklyTarget(kr = {}) {
  if (kr.weeklyTarget) return Number(kr.weeklyTarget);
  if (kr.type === "frequency") return Number(kr.target || 0);
  if (kr.cadence === "weekly") return Number(kr.target || 1);
  return 7;
}

function getHabitStatus({ kr = {}, todayDone = false, weekCount = 0, weeklyTarget = 0 } = {}) {
  const cadence = kr.cadence || (kr.type === "frequency" ? "weekly" : "daily");
  if (cadence === "daily") return todayDone ? "current" : "attention";
  if (weeklyTarget && weekCount >= weeklyTarget) return "current";
  return "attention";
}

function formatHabitStatusLabel(status, { todayDone = false, weekCount = 0, weeklyTarget = 0 } = {}) {
  if (status === "current") return "current";
  if (!todayDone && weeklyTarget >= 7) return "missing today";
  if (weeklyTarget) return `${weekCount}/${weeklyTarget} this week`;
  return "needs log";
}

async function countHabitActivityDates({ activity, start, end }) {
  const dates = new Set();
  let totalLogs = 0;
  if (!activity || !start || !end) return { dates: [], totalLogs };
  for (const month of getMonthSlugsBetween(start, end)) {
    const relativePath = `2.Areas/Personal/fleeting/${month}.md`;
    let markdown = "";
    try {
      markdown = await fs.readFile(resolveVaultRelativePath(relativePath), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      continue;
    }
    let currentDate = "";
    for (const line of markdown.split(/\r?\n/)) {
      const heading = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
      if (heading) {
        currentDate = heading[1];
        continue;
      }
      if (!currentDate || currentDate < start || currentDate > end) continue;
      const pattern = new RegExp(`\\[activity::\\s*${escapeRegExp(activity)}\\s*]`, "i");
      if (!pattern.test(line)) continue;
      dates.add(currentDate);
      totalLogs += 1;
    }
  }
  return { dates: Array.from(dates).sort(), totalLogs };
}

function getActivityStreak(activityDates = [], today = formatDate(new Date())) {
  const dates = new Set(activityDates);
  let cursor = dates.has(today) ? today : addDaysToIsoDate(today, -1);
  let streak = 0;
  while (cursor && dates.has(cursor)) {
    streak += 1;
    cursor = addDaysToIsoDate(cursor, -1);
  }
  return streak;
}

function getHabitConsistencyPeriods({ activityDates = [], start = "", end = "", today = formatDate(new Date()), cadence = "daily", weeklyTarget = 1 } = {}) {
  const dates = new Set(activityDates);
  const rangeStart = normalizeIsoDate(start);
  const rangeEnd = normalizeIsoDate(end);
  if (!rangeStart || !rangeEnd) return { weeks: [], currentWeekDays: [] };

  const currentWeekStart = getIsoWeekStart(today);
  const visibleRangeEnd = rangeEnd < addDaysToIsoDate(currentWeekStart, 6) ? rangeEnd : addDaysToIsoDate(currentWeekStart, 6);
  const weeks = [];
  let weekStart = getIsoWeekStart(rangeStart);
  while (weekStart && weekStart <= visibleRangeEnd) {
    const weekEnd = addDaysToIsoDate(weekStart, 6);
    const clippedStart = weekStart < rangeStart ? rangeStart : weekStart;
    const clippedEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;
    const weekDates = getIsoDateRange(clippedStart, clippedEnd);
    const count = weekDates.filter((date) => dates.has(date)).length;
    const target = Math.min(Number(weeklyTarget || 1), weekDates.length || Number(weeklyTarget || 1));
    const current = weekStart === currentWeekStart;
    weeks.push({
      start: weekStart,
      end: weekEnd,
      count,
      target,
      current,
      loggedDays: weekDates.filter((date) => dates.has(date)),
      days: weekDates.map((date) => ({
        date,
        logged: dates.has(date),
        future: date > today,
        today: date === today,
        status: dates.has(date) ? "done" : (date >= today ? "pending" : "missed")
      })),
      status: getHabitWeekStatus({ count, target, weekEnd, today, current })
    });
    weekStart = addDaysToIsoDate(weekStart, 7);
  }

  const currentWeek = weeks.find((week) => week.current) || null;
  const currentWeekDays = cadence === "daily" && currentWeek
    ? getIsoDateRange(currentWeek.start < rangeStart ? rangeStart : currentWeek.start, currentWeek.end > rangeEnd ? rangeEnd : currentWeek.end)
      .map((date) => ({
        date,
        logged: dates.has(date),
        future: date > today,
        today: date === today,
        status: dates.has(date) ? "done" : (date >= today ? "pending" : "missed")
      }))
    : [];

  return {
    weeks: cadence === "daily" ? weeks.filter((week) => !week.current) : weeks,
    currentWeekDays
  };
}

function getIsoDateRange(startIso, endIso) {
  const dates = [];
  let cursor = normalizeIsoDate(startIso);
  const end = normalizeIsoDate(endIso);
  while (cursor && end && cursor <= end) {
    dates.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dates;
}

function getHabitWeekStatus({ count = 0, target = 1, weekEnd = "", today = formatDate(new Date()), current = false } = {}) {
  if (count >= target) return "done";
  if (current || weekEnd >= today) return count > 0 ? "current-partial" : "pending";
  if (count > 0) return "partial";
  return "missed";
}

function getWeeklyHabitStreak(weeks = []) {
  let index = weeks.length - 1;
  while (index >= 0 && weeks[index]?.current && weeks[index].status !== "done") index -= 1;
  let streak = 0;
  for (; index >= 0; index -= 1) {
    if (weeks[index]?.status !== "done") break;
    streak += 1;
  }
  return streak;
}

function getInclusiveIsoDateCount(startIso, endIso) {
  const diff = getIsoDayDiff(startIso, endIso);
  return diff === null ? 0 : Math.max(0, diff + 1);
}

function getProgressPercent(current, target) {
  const safeTarget = Number(target || 0);
  if (!safeTarget) return 0;
  const safeCurrent = Number(current || 0);
  return Math.max(0, Math.min(100, Math.round((safeCurrent / safeTarget) * 100)));
}

function buildSprintReview({ sprintMeta, activeKr, activityCounts, today }) {
  const weeklyCheckboxes = sprintMeta.weeklyCheckboxes || [];
  const uncheckedWeeks = weeklyCheckboxes.filter((item) => !item.done);
  const activity = sprintMeta.activeKrActivity || activeKr?.activity || "";
  const counts = activityCounts[activity] || { sprintCount: 0, weekCounts: {} };
  const target = Number(activeKr?.target || 0);
  const missedActivityWeeks = activeKr?.type === "frequency" && target
    ? weeklyCheckboxes
      .filter((item) => item.week && (!today || item.week <= today))
      .map((item) => ({
        week: item.week,
        label: item.label || `Week of ${item.week}`,
        count: Number(counts.weekCounts?.[item.week] || 0),
        target
      }))
      .filter((item) => item.count < item.target)
    : [];
  const activeKrStatus = String(activeKr?.status || "").toLowerCase();
  return {
    uncheckedWeekCount: uncheckedWeeks.length,
    uncheckedWeeks: uncheckedWeeks.map((item) => ({ week: item.week, label: item.label })),
    missedActivityWeekCount: missedActivityWeeks.length,
    missedActivityWeeks,
    incompleteActiveKr: Boolean(activeKr && activeKrStatus && activeKrStatus !== "done"),
    activeKrStatus: activeKr?.status || "",
    activityCount: counts.sprintCount || 0
  };
}

function buildSprintPreview({ sprintMeta, today }) {
  const startsInDays = getIsoDayDiff(today, sprintMeta.sprintStart);
  return {
    startsInDays: Number.isFinite(startsInDays) ? startsInDays : null,
    plannedWeekCount: sprintMeta.weeklyCheckboxes.length,
    plannedWeeks: sprintMeta.weeklyCheckboxes.map((item) => ({
      week: item.week,
      label: item.label,
      done: item.done
    }))
  };
}

async function countSprintActivities({ activities, sprintStart, sprintEnd }) {
  const result = {};
  for (const activity of activities) result[activity] = { sprintCount: 0, weekCount: 0, weekCounts: {} };
  if (!activities.length || !sprintStart || !sprintEnd) return result;
  const currentWeekStart = getIsoWeekStart(getTodayIsoDate());
  const currentWeekEnd = addDaysToIsoDate(currentWeekStart, 6);
  for (const month of getMonthSlugsBetween(sprintStart, sprintEnd)) {
    const relativePath = `2.Areas/Personal/fleeting/${month}.md`;
    let markdown = "";
    try {
      markdown = await fs.readFile(resolveVaultRelativePath(relativePath), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      continue;
    }
    let currentDate = "";
    for (const line of markdown.split(/\r?\n/)) {
      const heading = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
      if (heading) {
        currentDate = heading[1];
        continue;
      }
      if (!currentDate || currentDate < sprintStart || currentDate > sprintEnd) continue;
      for (const activity of activities) {
        const pattern = new RegExp(`\\[activity::\\s*${escapeRegExp(activity)}\\s*]`, "i");
        if (!pattern.test(line)) continue;
        const activityWeekStart = getIsoWeekStart(currentDate);
        result[activity].sprintCount += 1;
        result[activity].weekCounts[activityWeekStart] = Number(result[activity].weekCounts[activityWeekStart] || 0) + 1;
        if (currentDate >= currentWeekStart && currentDate <= currentWeekEnd) result[activity].weekCount += 1;
      }
    }
  }
  return result;
}

function getMonthSlugsBetween(startIso, endIso) {
  const months = [];
  const cursor = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!cursor || !end) return months;
  cursor.setDate(1);
  while (cursor <= end) {
    months.push(getCurrentMonthSlug(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function getIsoWeekStart(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return "";
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return formatDate(date);
}

function addDaysToIsoDate(isoDate, days) {
  const date = parseIsoDate(isoDate);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function getIsoDayDiff(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function parseIsoDate(isoDate) {
  const clean = normalizeIsoDate(isoDate);
  if (!clean) return null;
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeIsoDate(value) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

async function getTasks({ status = "open", scope = "all", source = "all", focus = "all", limit = 100 } = {}) {
  await ensureIndexSchema();
  const normalizedStatus = ["open", "done", "all"].includes(status) ? status : "open";
  const normalizedScope = ["all", "work", "personal"].includes(scope) ? scope : "all";
  const normalizedSource = ["all", "fleeting", "projects", "areas"].includes(source) ? source : "all";
  const normalizedFocus = [
    "all",
    "due",
    "due-soon",
    "high",
    "do-now",
    "schedule",
    "quick",
    "someday",
    "triage"
  ].includes(focus) ? focus : "all";
  const whereClause = buildTaskWhereClause({ status: normalizedStatus, scope: normalizedScope, source: normalizedSource, focus: normalizedFocus });
  const countRows = await dbQuery(`
    SELECT COUNT(*) AS total_count
    FROM tasks
    ${whereClause}
  `);
  const rows = await dbQuery(`
    SELECT task_id, note_id, path, line_number, status, text, priority, due, effort, important, urgent, project, context, updated
    FROM tasks
    ${whereClause}
    ORDER BY
      CASE LOWER(COALESCE(priority, '')) WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
      CASE WHEN due IS NULL OR due = '' THEN 1 ELSE 0 END,
      due ASC,
      datetime(updated) DESC
    LIMIT ${Number(limit)}
  `);

  return {
    status: normalizedStatus,
    scope: normalizedScope,
    source: normalizedSource,
    focus: normalizedFocus,
    totalCount: Number(countRows[0]?.total_count || 0),
    limit: Number(limit),
    tasks: rows.map((row) => ({
      id: row.task_id,
      noteId: row.note_id,
      path: row.path,
      lineNumber: Number(row.line_number),
      status: row.status,
      text: row.text,
      priority: row.priority || null,
      due: row.due || null,
      effort: row.effort || null,
      important: normalizeNullableBoolean(row.important),
      urgent: normalizeNullableBoolean(row.urgent),
      hasTodoMetadata: hasTodoMetadata(row),
      quadrant: getTaskQuadrant(row),
      project: row.project || null,
      context: row.context || null,
      updated: row.updated
    }))
  };
}

async function toggleTask(body) {
  const task = await getIndexedTaskById(body?.taskId);
  const filePath = resolveVaultMarkdownPath(task.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const { lines, newline } = splitMarkdownLines(markdown);
  const lineIndex = Number(task.line_number) - 1;
  const line = lines[lineIndex];

  if (!line) throw httpError(404, "Task line was not found.");

  const match = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.+)$/);
  if (!match) throw httpError(400, "Task line is not a Markdown checkbox.");

  const nextStatus = body?.status === "open" || body?.status === "done"
    ? body.status
    : task.status === "open" ? "done" : "open";
  const marker = nextStatus === "done" ? "x" : " ";
  lines[lineIndex] = `${match[1]}${marker}${match[3]}`;

  await fs.writeFile(filePath, joinMarkdownLines(lines, newline), "utf8");
  await reindexMarkdownFile(filePath, { reason: "task-toggle" });

  return {
    ok: true,
    taskId: task.task_id,
    status: nextStatus,
    path: task.path,
    lineNumber: Number(task.line_number)
  };
}

async function triageTask(body) {
  const task = await getIndexedTaskById(body?.taskId);
  const metadata = normalizeTodoCaptureMetadata(body);
  const filePath = resolveVaultMarkdownPath(task.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const { lines, newline } = splitMarkdownLines(markdown);
  const lineIndex = Number(task.line_number) - 1;
  const line = lines[lineIndex];

  if (!line) throw httpError(404, "Task line was not found.");
  if (!/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
    throw httpError(400, "Task line is not a Markdown checkbox.");
  }

  lines[lineIndex] = applyTodoMetadataToLine(line, metadata);

  await fs.writeFile(filePath, joinMarkdownLines(lines, newline), "utf8");
  await reindexMarkdownFile(filePath, { reason: "task-triage" });

  return {
    ok: true,
    taskId: task.task_id,
    metadata,
    path: task.path,
    lineNumber: Number(task.line_number)
  };
}

async function updateTask(body) {
  const task = await getIndexedTaskById(body?.taskId);
  const text = normalizeEditText(body?.text);
  const filePath = resolveVaultMarkdownPath(task.path);
  const markdown = await fs.readFile(filePath, "utf8");
  const { lines, newline } = splitMarkdownLines(markdown);
  const lineIndex = Number(task.line_number) - 1;
  const line = lines[lineIndex];

  if (!line) throw httpError(404, "Task line was not found.");
  if (!/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
    throw httpError(400, "Task line is not a Markdown checkbox.");
  }

  const replacement = replaceTaskTextInLine(line, text);
  lines.splice(lineIndex, 1, ...replacement);

  await fs.writeFile(filePath, joinMarkdownLines(lines, newline), "utf8");
  await reindexMarkdownFile(filePath, { reason: "task-update" });

  return {
    ok: true,
    taskId: task.task_id,
    text,
    path: task.path,
    lineNumber: Number(task.line_number)
  };
}

async function getIndexedTaskById(taskId) {
  const id = String(taskId || "").trim();
  if (!id) throw httpError(400, "Task id is required.");
  const rows = await dbQuery(`
    SELECT task_id, path, line_number, status, text
    FROM tasks
    WHERE task_id = ${sqlValue(id)}
    LIMIT 1
  `);
  const task = rows[0];
  if (!task) throw httpError(404, "Task was not found in the current index.");
  return task;
}

function resolveVaultMarkdownPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.endsWith(".md")) throw httpError(400, "Only Markdown tasks can be edited.");
  if (shouldSkipRelativeVaultPath(normalized)) throw httpError(400, "This task path is ignored by Tasks.");

  const root = path.resolve(VAULT_PATH);
  const filePath = path.resolve(root, normalized);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw httpError(400, "Task path is outside the configured vault.");
  }
  return filePath;
}

function splitMarkdownLines(markdown) {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingNewline = markdown.endsWith("\n");
  const lines = markdown.split(/\r?\n/);
  if (hasTrailingNewline) lines.pop();
  return { lines, newline };
}

function joinMarkdownLines(lines, newline) {
  return `${lines.join(newline)}${newline}`;
}

function applyTodoMetadataToLine(line, metadata) {
  const keys = ["type", "important", "urgent", "priority", "due", "effort"];
  let next = line;
  for (const key of keys) {
    next = next.replace(new RegExp(`\\s*\\[${key}::\\s*[^\\]]+\\]`, "ig"), "");
  }

  const fields = [
    "[type:: todo]",
    `[important:: ${metadata.important ? "true" : "false"}]`,
    `[urgent:: ${metadata.urgent ? "true" : "false"}]`,
    `[priority:: ${metadata.priority}]`,
    metadata.due ? `[due:: ${metadata.due}]` : "",
    metadata.effort ? `[effort:: ${metadata.effort}]` : ""
  ].filter(Boolean);

  return `${next.trimEnd()} ${fields.join(" ")}`;
}

function normalizeEditText(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const text = lines.join("\n");
  if (!text) throw httpError(400, "Edited text is required.");
  return text;
}

function replaceTaskTextInLine(line, text) {
  const editLines = text.split("\n");
  const [first, ...rest] = editLines;
  const match = String(line || "").match(/^(\s*[-*]\s+\[[ xX]\]\s+)(.+?)\s*$/);
  if (!match) throw httpError(400, "Task line is not a Markdown checkbox.");

  const body = match[2];
  const fields = [...body.matchAll(/\s*\[[A-Za-z0-9_-]+::\s*[^\]]+\]/g)]
    .map((fieldMatch) => fieldMatch[0].trim())
    .filter(Boolean);
  const bodyWithoutFields = body
    .replace(/\s*\[[A-Za-z0-9_-]+::\s*[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const time = readLeadingTaskTime(bodyWithoutFields);
  const timePrefix = time ? `${time} ` : "";
  const fieldText = fields.length ? ` ${fields.join(" ")}` : "";
  const continuationPrefix = `${match[1].match(/^\s*/)[0]}  `;

  return [
    `${match[1]}${timePrefix}${first}${fieldText}`,
    ...rest.map((textLine) => `${continuationPrefix}${textLine}`)
  ];
}

function buildTaskWhereClause({ status, scope, source, focus }) {
  const clauses = [];
  const dueSoonCutoff = formatDate(addDays(new Date(), 7));
  if (status !== "all") clauses.push(`status = ${sqlValue(status)}`);
  if (scope === "work") {
    clauses.push(`(path LIKE '2.Areas/Career/%' OR path LIKE '1.Projects/%' OR path LIKE '4.Archive/work/%')`);
  }
  if (scope === "personal") {
    clauses.push(`(path LIKE '2.Areas/Personal/%' OR path LIKE '1.Projects/columbus/%')`);
  }
  if (source === "fleeting") clauses.push(`path LIKE '2.Areas/Personal/fleeting/%'`);
  if (source === "projects") clauses.push(`path LIKE '1.Projects/%'`);
  if (source === "areas") clauses.push(`path LIKE '2.Areas/%'`);
  if (focus === "due") clauses.push(`COALESCE(due, '') <> ''`);
  if (focus === "due-soon") {
    clauses.push(`COALESCE(due, '') <> '' AND date(due) <= date(${sqlValue(dueSoonCutoff)})`);
  }
  if (focus === "high") {
    clauses.push(`(LOWER(COALESCE(priority, '')) = 'high'
      OR (LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'true'))`);
  }
  if (focus === "do-now") {
    clauses.push(`LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'true'`);
  }
  if (focus === "schedule") {
    clauses.push(`LOWER(COALESCE(important, '')) = 'true' AND LOWER(COALESCE(urgent, '')) = 'false'`);
  }
  if (focus === "quick") {
    clauses.push(`LOWER(COALESCE(important, '')) = 'false' AND LOWER(COALESCE(urgent, '')) = 'true'`);
  }
  if (focus === "someday") {
    clauses.push(`LOWER(COALESCE(important, '')) = 'false' AND LOWER(COALESCE(urgent, '')) = 'false'`);
  }
  if (focus === "triage") {
    clauses.push(`COALESCE(important, '') = '' AND COALESCE(urgent, '') = ''`);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function normalizeTaskSummary(row) {
  return {
    openCount: Number(row.open_count || 0),
    workCount: Number(row.work_count || 0),
    personalCount: Number(row.personal_count || 0),
    dueCount: Number(row.due_count || 0),
    dueSoonCount: Number(row.due_soon_count || 0),
    highCount: Number(row.high_count || 0),
    doNowCount: Number(row.do_now_count || 0),
    scheduleCount: Number(row.schedule_count || 0),
    quickCount: Number(row.quick_count || 0),
    somedayCount: Number(row.someday_count || 0),
    triageCount: Number(row.triage_count || 0)
  };
}

function normalizeNullableBoolean(value) {
  const normalized = normalizeBooleanString(value);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function hasTodoMetadata(row) {
  return normalizeNullableBoolean(row.important) !== null || normalizeNullableBoolean(row.urgent) !== null;
}

function getTaskQuadrant(row) {
  const important = normalizeNullableBoolean(row.important);
  const urgent = normalizeNullableBoolean(row.urgent);
  if (important === true && urgent === true) return "do-now";
  if (important === true && urgent === false) return "schedule";
  if (important === false && urgent === true) return "quick";
  if (important === false && urgent === false) return "someday";
  return "triage";
}

async function collectMarkdownFiles(dirPath, files, skipped) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    skipped.count += 1;
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relative = toVaultPath(fullPath);
    if (shouldSkipVaultPath(relative, entry)) {
      skipped.count += 1;
      continue;
    }

    if (entry.isDirectory()) {
      await collectMarkdownFiles(fullPath, files, skipped);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }
}

function shouldSkipVaultPath(relativePath, entry) {
  if (entry.isDirectory() && isSkillDirectoryPrefix(relativePath)) return false;
  if (entry.isDirectory() && isPeopleDirectoryPrefix(relativePath)) return false;
  if (entry.isDirectory() && (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith("."))) return true;
  return shouldSkipVaultPathForIndex(relativePath);
}

function shouldSkipVaultPathForIndex(relativePath) {
  if (isSkillMarkdownPath(relativePath) || isPeopleMarkdownPath(relativePath)) {
    return SENSITIVE_PATH_PATTERN.test(relativePath);
  }
  const segments = String(relativePath || "").split("/").filter(Boolean);
  if (segments.some((segment) => SKIPPED_DIRS.has(segment) || segment.startsWith("."))) return true;
  if (segments.some((segment) => SKIPPED_PATH_PARTS.has(segment.toLowerCase()))) return true;
  return SENSITIVE_PATH_PATTERN.test(relativePath);
}

function shouldSkipRelativeVaultPath(relativePath) {
  if (isSkillMarkdownPath(relativePath)) {
    return matchesIndexIgnore(relativePath) || SENSITIVE_PATH_PATTERN.test(relativePath);
  }
  if (isPeopleMarkdownPath(relativePath)) {
    return SENSITIVE_PATH_PATTERN.test(relativePath);
  }
  const segments = String(relativePath || "").split("/").filter(Boolean);
  if (segments.some((segment) => SKIPPED_DIRS.has(segment) || segment.startsWith("."))) return true;
  if (segments.some((segment) => SKIPPED_PATH_PARTS.has(segment.toLowerCase()))) return true;
  if (matchesIndexIgnore(relativePath)) return true;
  return SENSITIVE_PATH_PATTERN.test(relativePath);
}

function isSkillDirectoryPrefix(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/\/+$/, "");
  return normalized === ".agents" || normalized === SKILL_ROOT || normalized.startsWith(`${SKILL_ROOT}/`);
}

function isSkillMarkdownPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  return normalized.startsWith(`${SKILL_ROOT}/`) && normalized.toLowerCase().endsWith(".md");
}

function isPeopleDirectoryPrefix(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/\/+$/, "");
  return [
    "2.Areas",
    "2.Areas/Personal",
    "2.Areas/Personal/People",
    "3.Resources",
    "3.Resources/People"
  ].some((prefix) => normalized === prefix || prefix.startsWith(`${normalized}/`) || normalized.startsWith(`${prefix}/`));
}

function isPeopleMarkdownPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  return (
    normalized.startsWith("2.Areas/Personal/People/") ||
    normalized.startsWith("3.Resources/People/")
  ) && normalized.toLowerCase().endsWith(".md");
}

function shouldIndexNote(note) {
  const type = String(note.type || "").toLowerCase();
  if (isSkillMarkdownPath(note.path)) {
    return type === "mentor" || type === "assistant";
  }
  if (isPeopleMarkdownPath(note.path)) {
    return type === "people";
  }
  return true;
}

function parseMarkdownNote({ filePath, markdown, stat }) {
  const relativePath = toVaultPath(filePath);
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const isSkill = isSkillMarkdownPath(relativePath);
  const title = metadata.title || metadata.name || findFirstHeading(body) || skillFolderName(relativePath) || path.basename(filePath, ".md");
  const type = metadata.type || "";
  const name = metadata.name || (isSkill ? skillFolderName(relativePath) : "");
  const para = metadata.para || inferPara(relativePath);
  const project = metadata.project || inferProject(relativePath, para);
  const headings = JSON.stringify(extractHeadings(body));
  const tags = JSON.stringify(extractTags(markdown, metadata.tags));
  const content = normalizeMarkdown([metadata.description, body].filter(Boolean).join("\n\n"));

  return {
    noteId: hash(relativePath),
    path: relativePath,
    title,
    type,
    name,
    para,
    project,
    created: metadata.created || null,
    updated: stat.mtime.toISOString(),
    tags,
    headings,
    snippet: content.slice(0, 360),
    content
  };
}

function extractTasks(note, markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!match) continue;

    const indent = match[1].length;
    const status = match[2].trim().toLowerCase() === "x" ? "done" : "open";
    const metadataLines = [];
    for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 5); lookahead += 1) {
      const line = lines[lookahead];
      if (/^\s*[-*]\s+\[[ xX]\]/.test(line)) break;
      if (line.trim() && leadingSpaces(line) > indent) metadataLines.push(line.trim());
    }

    const metadataSource = `${match[3]}\n${metadataLines.join("\n")}`;
    const important = normalizeBooleanString(readInlineMetadata(metadataSource, "important"));
    const urgent = normalizeBooleanString(readInlineMetadata(metadataSource, "urgent"));
    const priority = readInlineMetadata(metadataSource, "priority") || derivePriority({ important, urgent });
    const due = readInlineMetadata(metadataSource, "due");
    const effort = normalizeEffortInput(readInlineMetadata(metadataSource, "effort"));
    const project = readInlineMetadata(metadataSource, "project") || note.project;
    const text = cleanTaskText(match[3]);

    tasks.push({
      taskId: hash(`${note.path}:${index + 1}:${match[3]}`),
      noteId: note.noteId,
      path: note.path,
      lineNumber: index + 1,
      status,
      text,
      priority,
      due,
      effort,
      important,
      urgent,
      project,
      context: metadataLines.join(" "),
      updated: note.updated
    });
  }
  return tasks;
}

function splitFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return { frontmatter: "", body: markdown };
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: "", body: markdown };
  return {
    frontmatter: markdown.slice(3, end).trim(),
    body: markdown.slice(end + 4).trimStart()
  };
}

function parseFrontmatter(frontmatter) {
  const result = {};
  const lines = frontmatter.split(/\r?\n/);
  let inMetadata = false;
  for (const line of lines) {
    const metadataStart = line.match(/^metadata:\s*$/);
    if (metadataStart) {
      inMetadata = true;
      continue;
    }

    if (inMetadata) {
      if (/^[A-Za-z0-9_-]+:\s*/.test(line)) inMetadata = false;
      const nestedType = line.match(/^\s*(?:-\s*)?type:\s*(.*)$/);
      if (nestedType) {
        result.type = nestedType[1].replace(/^["']|["']$/g, "").trim();
        continue;
      }
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "").trim();
    if (key === "metadata.type") {
      result.type = value;
      continue;
    }
    result[key] = value;
  }
  return result;
}

function findFirstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1]) : "";
}

function extractHeadings(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ level: match[1].length, text: stripMarkdown(match[2]) }))
    .slice(0, 40);
}

function extractTags(markdown, frontmatterTags) {
  const tags = new Set();
  if (frontmatterTags) {
    String(frontmatterTags)
      .replace(/[[\],]/g, " ")
      .split(/\s+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  }
  for (const match of markdown.matchAll(/(?:^|\s)#([A-Za-z0-9/_-]+)/g)) {
    tags.add(match[1]);
  }
  return Array.from(tags).sort();
}

function inferPara(relativePath) {
  const first = relativePath.split("/")[0] || "";
  if (first.startsWith("1.")) return "project";
  if (first.startsWith("2.")) return "area";
  if (first.startsWith("3.")) return "resource";
  if (first.startsWith("4.")) return "archive";
  return "";
}

function inferProject(relativePath, para) {
  const segments = relativePath.split("/");
  if (para === "project" && segments.length > 1) return segments[1];
  return "";
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdown(value) {
  return String(value)
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .trim();
}

function quoteYaml(value) {
  return JSON.stringify(String(value || ""));
}

function updateFrontmatterField(markdown, key, value) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  const frontmatter = markdown.slice(3, end);
  const body = markdown.slice(end);
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m");
  const line = `${key}: ${value}`;
  const nextFrontmatter = pattern.test(frontmatter)
    ? frontmatter.replace(pattern, line)
    : `${frontmatter.trimEnd()}\n${line}\n`;
  return `---${nextFrontmatter}${body}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTaskText(value) {
  return stripMarkdown(
    String(value)
      .replace(/\[[A-Za-z0-9_-]+::\s*[^\]]+]/g, "")
      .replace(/\b[A-Za-z0-9_-]+::\s+\S+/g, "")
      .replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s+/i, "")
      .replace(/\s+/g, " ")
  );
}

function readLeadingTaskTime(value) {
  const match = String(value || "").match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
  return match ? match[1].replace(/\s+/, " ").toUpperCase() : "";
}

function readInlineMetadata(text, key) {
  const bracket = new RegExp(`\\[${key}::\\s*([^\\]]+)\\]`, "i").exec(text);
  if (bracket) return bracket[1].trim();
  const plain = new RegExp(`(?:^|\\s)${key}::\\s*([^\\n]+)`, "i").exec(text);
  return plain ? plain[1].trim() : "";
}

function formatNoteRow(row) {
  return {
    id: row.note_id,
    path: row.path,
    title: row.title,
    para: row.para || null,
    project: row.project || null,
    updated: row.updated,
    snippet: row.snippet || ""
  };
}

function makeSearchSnippet(content, terms) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const index = terms
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0] || 0;
  const start = Math.max(0, index - 80);
  const snippet = normalized.slice(start, start + 260);
  return `${start > 0 ? "... " : ""}${snippet}${start + 260 < normalized.length ? " ..." : ""}`;
}

function countOccurrences(value, term) {
  if (!term) return 0;
  return value.split(term).length - 1;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

function leadingSpaces(value) {
  return value.match(/^\s*/)[0].length;
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function toVaultPath(filePath) {
  return path.relative(VAULT_PATH, filePath).split(path.sep).join("/");
}

function normalizeVaultRelativeDir(relativePath) {
  const normalized = String(relativePath || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid vault relative directory.");
  }
  return normalized;
}

function normalizeVaultRelativeMarkdownPath(relativePath) {
  const normalized = String(relativePath || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !normalized.endsWith(".md")) {
    throw new Error("Invalid vault relative Markdown path.");
  }
  return normalized;
}

function resolveVaultRelativePath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) throw httpError(400, "Invalid vault path.");
  const root = path.resolve(VAULT_PATH);
  const filePath = path.resolve(root, normalized);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw httpError(400, "Path is outside the configured vault.");
  }
  return filePath;
}

function normalizeChatSessionPath(sessionPath) {
  const normalized = String(sessionPath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.endsWith(".md")) throw httpError(400, "Chat session path must be a Markdown file.");
  if (!normalized.startsWith(`${CHAT_SESSIONS_DIR}/`)) {
    throw httpError(400, "Chat session path is outside the configured sessions folder.");
  }
  return normalized;
}

function resolveChatSessionPath(sessionPath) {
  return resolveVaultRelativePath(normalizeChatSessionPath(sessionPath));
}

function getCurrentMonthlyCaptureFile() {
  return path.join(getFleetingDir(), `${getCurrentMonthSlug()}.md`);
}

function getFleetingDir() {
  return path.join(VAULT_PATH, "2.Areas", "Personal", "fleeting");
}

function getCurrentMonthSlug(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getTodayIsoDate() {
  const override = normalizeIsoDate(process.env.APP_DATE_OVERRIDE || "");
  return override || formatDate(new Date());
}

function formatDayHeading(date) {
  return `## ${formatDate(date)}`;
}

function formatDate(date) {
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

function daysBetweenIsoDates(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function formatTimestamp(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

async function appendCapture(body) {
  const category = String(body?.category || "thought").trim().toLowerCase();
  const text = String(body?.text || "").trim();

  if (!CAPTURE_CATEGORIES.has(category)) {
    throw httpError(400, "Invalid capture category.");
  }

  if (!text) {
    throw httpError(400, "Capture text is required.");
  }

  const date = new Date();
  const dayHeading = formatDayHeading(date);
  const todo = category === "todo" ? normalizeTodoCaptureMetadata(body) : null;
  const source = normalizeCaptureSource(body?.source || body?.sessionPath);
  const entry = formatCaptureEntry({ date, category, text, todo, source });
  const filePath = getCurrentMonthlyCaptureFile();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readFileIfExists(filePath);
  await fs.writeFile(filePath, appendToDaySection(existing, dayHeading, entry), "utf8");
  await reindexMarkdownFile(filePath, { reason: "capture-append" });

  return {
    id: `${date.getTime()}-${category}`,
    category,
    text,
    metadata: todo,
    content: entry,
    heading: dayHeading,
    timestamp: date.toISOString()
  };
}

async function updateCapture(body) {
  const content = String(body?.content || "").replace(/\r\n/g, "\n").trimEnd();
  const text = normalizeEditText(body?.text);
  const category = normalizeOptionalCaptureCategory(body?.category);
  if (!content) throw httpError(400, "Capture content is required.");

  const filePath = getCurrentMonthlyCaptureFile();
  const markdown = await readFileIfExists(filePath);
  if (!markdown.trim()) throw httpError(404, "Monthly capture file is empty.");

  const { lines, newline } = splitMarkdownLines(markdown);
  const contentLines = content.split("\n");
  const startIndex = findMarkdownBlock(lines, contentLines);
  if (startIndex < 0) throw httpError(404, "Capture was not found in the current monthly file.");

  const replacement = replaceCaptureText(contentLines, text, category);
  lines.splice(startIndex, contentLines.length, ...replacement);

  await fs.writeFile(filePath, joinMarkdownLines(lines, newline), "utf8");
  await reindexMarkdownFile(filePath, { reason: "capture-update" });

  return {
    ok: true,
    text,
    category: category || "",
    monthlyFile: filePath
  };
}

function normalizeOptionalCaptureCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (!category) return "";
  if (!CAPTURE_CATEGORIES.has(category)) {
    throw httpError(400, "Invalid capture category.");
  }
  return category;
}

function findMarkdownBlock(lines, blockLines) {
  for (let index = 0; index <= lines.length - blockLines.length; index += 1) {
    const matches = blockLines.every((blockLine, offset) => lines[index + offset].trimEnd() === blockLine.trimEnd());
    if (matches) return index;
  }
  return -1;
}

function replaceCaptureText(contentLines, text, category = "") {
  const firstLine = contentLines[0] || "";
  if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(firstLine)) {
    if (category && category !== "todo") {
      throw httpError(400, "Todo captures cannot be converted to another type yet.");
    }
    return replaceTaskTextInLine(firstLine, text);
  }

  if (category === "todo") {
    throw httpError(400, "Non-task captures cannot be converted to todo yet.");
  }

  const typedMatch = firstLine.match(/^(-\s+\d{1,2}:\d{2}(?:\s*[AP]M)?\s+\[type::\s*)(log|thought|idea|reflection)(\]\s+)(.+?)\s*$/i);
  if (typedMatch) {
    const [first, ...rest] = text.split("\n");
    const nextCategory = category || typedMatch[2].toLowerCase();
    const inlineFields = extractTrailingCaptureInlineFields(typedMatch[4]);
    return [
      `${typedMatch[1]}${nextCategory}${typedMatch[3]}${[first, inlineFields].filter(Boolean).join(" ")}`,
      ...rest.map((line) => `  ${line}`)
    ];
  }

  throw httpError(400, "This capture format cannot be edited yet.");
}

function extractTrailingCaptureInlineFields(text) {
  return String(text || "")
    .match(/(?:\s+(?:\[\[[A-Za-z0-9_-]+::\s*[^\]]+\]\]|\[[A-Za-z0-9_-]+::\s*[^\]]+\]))+\s*$/)?.[0]
    ?.trim() || "";
}

function formatCaptureEntry({ date, category, text, todo = null, source = "" }) {
  const time = formatTime(date);
  if (category === "todo") {
    return formatTodo(text, date, todo, source);
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [first, ...rest] = lines;
  const sourceField = formatCaptureSourceField(source);
  const continuation = rest.map((line) => `  ${line}`).join("\n");
  return [`- ${time} [type:: ${category}] ${first} ${sourceField}`.trimEnd(), continuation].filter(Boolean).join("\n");
}

function normalizeCaptureSource(value) {
  const normalized = String(value || "").trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized) return "";
  if (!normalized.endsWith(".md")) throw httpError(400, "Capture source must be a Markdown file.");
  if (!normalized.startsWith(`${CHAT_SESSIONS_DIR}/`)) throw httpError(400, "Capture source must be a chat session.");
  return normalized;
}

function formatCaptureSourceField(source) {
  if (!source) return "";
  return `[source:: [[${source}]]]`;
}

function normalizeTodoCaptureMetadata(body) {
  const important = parseBooleanInput(body?.important);
  const urgent = parseBooleanInput(body?.urgent);
  const due = String(body?.due || "").trim();
  const effort = normalizeEffortInput(body?.effort);

  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    throw httpError(400, "Due date must use YYYY-MM-DD.");
  }

  return {
    important,
    urgent,
    due: due || "",
    effort,
    priority: derivePriority({ important: String(important), urgent: String(urgent) })
  };
}

function normalizeEffortInput(value) {
  const effort = String(value || "").trim().toLowerCase();
  return effort === "5m" || effort === "5 min" || effort === "5 minutes" ? "5m" : "";
}

function parseBooleanInput(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return false;
}

function formatTodo(text, date, metadata = null, source = "") {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "- [ ]";
  const [first, ...rest] = lines;
  const time = formatTime(date);
  const fields = [
    "[type:: todo]",
    metadata ? `[important:: ${metadata.important ? "true" : "false"}]` : "",
    metadata ? `[urgent:: ${metadata.urgent ? "true" : "false"}]` : "",
    metadata?.priority ? `[priority:: ${metadata.priority}]` : "",
    metadata?.due ? `[due:: ${metadata.due}]` : "",
    metadata?.effort ? `[effort:: ${metadata.effort}]` : "",
    formatCaptureSourceField(source)
  ].filter(Boolean).join(" ");

  return [
    `- [ ] ${time} ${first} ${fields}`,
    ...rest.map((line) => `  ${line}`)
  ].join("\n");
}

function appendToDaySection(markdown, dayHeading, entry) {
  const trimmed = markdown.trimEnd();
  if (!trimmed) {
    return `${dayHeading}\n\n${entry}\n`;
  }

  const lines = trimmed.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === dayHeading);

  if (headingIndex === -1) {
    return `${trimmed}\n\n${dayHeading}\n\n${entry}\n`;
  }

  let insertIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      insertIndex = index;
      break;
    }
  }

  const sectionHasEntry = lines.slice(headingIndex + 1, insertIndex).some((line) => line.trim());
  const insertLines = sectionHasEntry ? [entry] : ["", entry];
  lines.splice(insertIndex, 0, ...insertLines);
  return `${lines.join("\n")}\n`;
}

async function readRecentCaptures(limit = 12) {
  const filePath = getCurrentMonthlyCaptureFile();
  const markdown = await readFileIfExists(filePath);
  if (!markdown.trim()) return [];

  const captures = [];
  const oldHeadingPattern = /^##\s+(.+?)\s+—\s+(log|thought|idea|todo|reflection)\s*$/;
  const dayHeadingPattern = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
  let currentOldCapture = null;
  let currentDay = null;

  for (const line of markdown.split(/\r?\n/)) {
    const oldHeadingMatch = line.match(oldHeadingPattern);
    if (oldHeadingMatch) {
      if (currentOldCapture) captures.push(finalizeOldCapture(currentOldCapture));
      currentOldCapture = {
        heading: line,
        label: oldHeadingMatch[1],
        category: oldHeadingMatch[2],
        lines: []
      };
      continue;
    }

    const dayHeadingMatch = line.match(dayHeadingPattern);
    if (dayHeadingMatch) {
      if (currentOldCapture) {
        captures.push(finalizeOldCapture(currentOldCapture));
        currentOldCapture = null;
      }
      currentDay = dayHeadingMatch[1];
      continue;
    }

    if (currentOldCapture) {
      currentOldCapture.lines.push(line);
      continue;
    }

    if (currentDay) {
      const parsed = parseStructuredCaptureLine(line, currentDay);
      if (parsed) {
        captures.push(parsed);
        continue;
      }

      const lastCapture = captures[captures.length - 1];
      if (lastCapture && lastCapture.heading === `## ${currentDay}` && /^\s{2,}\S/.test(line)) {
        const continuation = line.trim();
        lastCapture.text = `${lastCapture.text}\n${continuation}`;
        lastCapture.displayText = stripCaptureDisplayFields(lastCapture.text);
        lastCapture.content = `${lastCapture.content}\n${line}`;
      }
    }
  }

  if (currentOldCapture) captures.push(finalizeOldCapture(currentOldCapture));
  return captures.slice(-limit).reverse();
}

function finalizeOldCapture(capture) {
  const content = capture.lines.join("\n").trim();
  const text = content.replace(/^- \[ \]\s*/, "").trim();
  return {
    id: `${capture.label}-${capture.category}-${content.length}`,
    heading: capture.heading,
    label: capture.label,
    category: capture.category,
    text,
    displayText: stripCaptureDisplayFields(text),
    content
  };
}

function parseStructuredCaptureLine(line, day) {
  const typedPattern = /^-\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+\[type::\s*(log|thought|idea|reflection)\]\s+(.+?)\s*$/i;

  const todoMatch = line.match(/^-\s+\[ \]\s+(.+?)\s*$/);
  if (todoMatch) {
    const metadata = readInlineFields(todoMatch[1]);
    if (metadata.type?.toLowerCase() === "todo") {
      const text = cleanTaskText(todoMatch[1]);
      const leadingTime = readLeadingTaskTime(todoMatch[1]);
      const label = leadingTime ? `${day} ${leadingTime}` : metadata.created || day;
      const important = normalizeBooleanString(metadata.important);
      const urgent = normalizeBooleanString(metadata.urgent);
      return {
        id: `${label}-todo-${text.length}`,
        heading: `## ${day}`,
        label,
        category: "todo",
        text,
        displayText: stripCaptureDisplayFields(text),
        content: line.trim(),
        metadata: {
          important: important === "true",
          urgent: urgent === "true",
          priority: metadata.priority || derivePriority({ important, urgent }) || "",
          due: metadata.due || "",
          effort: normalizeEffortInput(metadata.effort)
        }
      };
    }
  }

  const legacyTodoMatch = line.match(/^-\s+\[ \]\s+(.+?)\s+\[type::\s*(todo)\]\s+\[created::\s*([^\]]+)\]\s*$/i);
  if (legacyTodoMatch) {
    return {
      id: `${legacyTodoMatch[3]}-todo-${legacyTodoMatch[1].length}`,
      heading: `## ${day}`,
      label: legacyTodoMatch[3],
      category: "todo",
      text: legacyTodoMatch[1].trim(),
      displayText: stripCaptureDisplayFields(legacyTodoMatch[1].trim()),
      content: line.trim()
    };
  }

  const typedMatch = line.match(typedPattern);
  if (typedMatch) {
    const label = `${day} ${typedMatch[1]}`;
    const text = typedMatch[3].trim();
    return {
      id: `${label}-${typedMatch[2]}-${text.length}`,
      heading: `## ${day}`,
      label,
      category: typedMatch[2],
      text,
      displayText: stripCaptureDisplayFields(text),
      content: line.trim()
    };
  }

  return null;
}

function stripCaptureDisplayFields(text) {
  return String(text || "")
    .replace(/\s*\[\[[A-Za-z0-9_-]+::\s*[^\]]*]]/g, "")
    .replace(/\s*\[[A-Za-z0-9_-]+::\s*(?:\[\[[^\]]*]]|[^\]])*]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function readInlineFields(text) {
  const fields = {};
  for (const match of String(text || "").matchAll(/\[([A-Za-z0-9_-]+)::\s*([^\]]+)]/g)) {
    fields[match[1].toLowerCase()] = match[2].trim();
  }
  return fields;
}

function normalizeBooleanString(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "important", "urgent", "1"].includes(normalized)) return "true";
  if (["false", "no", "not important", "not urgent", "0"].includes(normalized)) return "false";
  return "";
}

function derivePriority({ important, urgent } = {}) {
  const hasImportant = important === true || important === false || important === "true" || important === "false";
  const hasUrgent = urgent === true || urgent === false || urgent === "true" || urgent === "false";
  if (!hasImportant && !hasUrgent) return "";

  const isImportant = important === true || important === "true";
  const isUrgent = urgent === true || urgent === "true";
  if (isImportant && isUrgent) return "high";
  if (isImportant || isUrgent) return "medium";
  return "low";
}

function formatTimeFromDateString(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : formatTime(date);
}

async function dbExec(sql) {
  await runSqlite(sql);
}

async function dbQuery(sql) {
  const output = await runSqlite(sql, { json: true });
  if (!output.trim()) return [];
  return JSON.parse(output);
}

function runSqlite(sql, { json = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = json ? ["-json", DB_PATH] : [DB_PATH];
    const child = spawn(SQLITE_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `sqlite3 exited with code ${code}`));
      }
    });
    child.stdin.end(sql);
  });
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function serveStatic(requestPath, res) {
  const cleanPath = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      return res.end(index);
    }
    throw error;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

async function readRequestJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw httpError(413, "Request body is too large.");
  }

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw httpError(400, "Invalid JSON body.");
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
