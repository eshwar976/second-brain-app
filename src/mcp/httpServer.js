import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { CAPABILITY_RISK } from "../capabilities/manifest.js";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 60;

export function createMcpHttpServer({
  enabled,
  host,
  port,
  token,
  appSecret,
  allowedToolSet,
  clientToolAllowlists = new Map(),
  capabilities,
  capabilityDefinitions,
  executeCapability,
  auditLog,
  allowedOrigins = [],
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  rateLimitMax = DEFAULT_RATE_LIMIT_MAX,
  toVaultPath
}) {
  if (!enabled) return null;

  const rateLimitState = new Map();

  return http.createServer(async (req, res) => {
    try {
      return await handleMcpRequest(req, res, {
        host,
        port,
        token,
        appSecret,
        allowedToolSet,
        clientToolAllowlists,
        capabilities,
        capabilityDefinitions,
        executeCapability,
        auditLog,
        allowedOrigins,
        rateLimitWindowMs,
        rateLimitMax,
        rateLimitState,
        toVaultPath
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return sendHttpJson(res, status, { error: error.message || "Unexpected MCP server error" });
    }
  });
}

export function validateMcpConfig({ enabled, host, token, appSecret }) {
  if (!enabled) return;
  if (!isLoopbackHost(host) && !token) {
    throw new Error("MCP_TOKEN is required when MCP_HOST is not loopback.");
  }
  if (!token && !appSecret) {
    throw new Error("MCP requires MCP_TOKEN, or APP_SECRET for loopback-only development.");
  }
}

export function isLoopbackHost(host) {
  const normalized = String(host || "").trim().toLowerCase();
  return ["127.0.0.1", "localhost", "::1"].includes(normalized);
}

export async function readMcpAuditEntries(auditLog, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  try {
    const file = await fs.readFile(auditLog, "utf8");
    return file
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-safeLimit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { time: "", ok: false, error: "Invalid audit entry." };
        }
      })
      .reverse();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function handleMcpRequest(req, res, config) {
  setCorsHeaders(req, res, config.allowedOrigins);

  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req.headers.origin, config.allowedOrigins)) {
      return sendHttpJson(res, 403, { error: "Origin is not allowed." });
    }
    res.writeHead(204);
    return res.end();
  }

  if (!isOriginAllowed(req.headers.origin, config.allowedOrigins)) {
    return sendHttpJson(res, 403, { error: "Origin is not allowed." });
  }

  checkMcpRateLimit(req, config);

  const url = new URL(req.url || "/", `http://${req.headers.host || `${config.host}:${config.port}`}`);
  if (url.pathname === "/health" && req.method === "GET") {
    requireMcpAuth(req, config);
    return sendHttpJson(res, 200, {
      ok: true,
      name: "second-brain-mcp",
      tools: getMcpTools(config).length
    });
  }

  if (url.pathname !== "/mcp") return sendHttpJson(res, 404, { error: "Not found." });
  if (req.method !== "POST") return sendHttpJson(res, 405, { error: "MCP endpoint expects POST." });

  requireMcpAuth(req, config);
  const message = await readJson(req);
  const messages = Array.isArray(message) ? message : [message];
  const responses = [];

  for (const item of messages) {
    const response = await handleJsonRpc(item, req, config);
    if (response) responses.push(response);
  }

  if (!responses.length) {
    res.writeHead(202);
    return res.end();
  }
  return sendHttpJson(res, 200, Array.isArray(message) ? responses : responses[0]);
}

async function handleJsonRpc(message, req, config) {
  const id = message?.id;
  if (!message || message.jsonrpc !== "2.0" || !message.method) {
    return mcpError(id ?? null, -32600, "Invalid JSON-RPC request.");
  }

  try {
    switch (message.method) {
      case "initialize":
        return mcpResult(id, {
          protocolVersion: message.params?.protocolVersion || "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "second-brain-mcp", version: "0.1.0" }
        });
      case "notifications/initialized":
        return null;
      case "ping":
        return mcpResult(id, {});
      case "tools/list":
        return mcpResult(id, { tools: getMcpTools(config, getMcpClientName(req, message.params || {})) });
      case "tools/call":
        return await handleToolCall(id, message.params || {}, req, config);
      default:
        return mcpError(id, -32601, `Unsupported MCP method: ${message.method}`);
    }
  } catch (error) {
    return mcpError(id, error.statusCode === 403 ? -32003 : -32000, error.message || "MCP request failed.");
  }
}

async function handleToolCall(id, params, req, config) {
  const name = String(params?.name || "");
  const client = getMcpClientName(req, params);
  if (!name) return mcpError(id, -32602, "Tool name is required.");
  if (!config.allowedToolSet.has(name)) {
    await writeMcpAudit(config, { req, client, tool: name, ok: false, error: "Tool is not allowed." });
    return mcpError(id, -32003, `Tool is not allowed: ${name}`);
  }
  if (!isToolAllowedForClient(config, client, name)) {
    await writeMcpAudit(config, { req, client, tool: name, ok: false, error: "Tool is not allowed for this client." });
    return mcpError(id, -32003, `Tool is not allowed for this client: ${name}`);
  }
  const capability = config.capabilityDefinitions.get(name);
  if (!capability) return mcpError(id, -32601, `Unknown tool: ${name}`);

  try {
    const result = await config.executeCapability(name, params.arguments || {});
    await writeMcpAudit(config, {
      req,
      client,
      tool: name,
      risk: capability.risk,
      wrote: capability.risk !== CAPABILITY_RISK.read,
      ok: true,
      path: getMcpAuditPath(result, config.toVaultPath)
    });
    return mcpResult(id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    });
  } catch (error) {
    await writeMcpAudit(config, {
      req,
      client,
      tool: name,
      risk: capability.risk,
      wrote: false,
      ok: false,
      error: error.message
    });
    return mcpError(id, -32000, error.message || `Tool failed: ${name}`);
  }
}

function getMcpTools(config, client = "") {
  return config.capabilities
    .filter((capability) => config.allowedToolSet.has(capability.name))
    .filter((capability) => isToolAllowedForClient(config, client, capability.name))
    .map((capability) => ({
      name: capability.name,
      description: capability.description,
      inputSchema: capability.input || { type: "object", properties: {} }
    }));
}

function isToolAllowedForClient(config, client, toolName) {
  const normalizedClient = String(client || "").trim().toLowerCase();
  if (!normalizedClient || !config.clientToolAllowlists?.size) return true;
  const scopedTools = config.clientToolAllowlists.get(normalizedClient);
  if (!scopedTools) return true;
  return scopedTools.has(String(toolName || "").toLowerCase());
}

function requireMcpAuth(req, config) {
  const provided = getProvidedToken(req);
  const expected = config.token || (isLoopbackHost(config.host) ? config.appSecret : "");
  if (!expected || !timingSafeEqual(provided, expected)) {
    throw httpError(401, "MCP token required.");
  }
}

function getProvidedToken(req) {
  const auth = req.headers.authorization || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const appSecretHeader = req.headers["x-second-brain-secret"] || "";
  return String(bearer || appSecretHeader || "");
}

function checkMcpRateLimit(req, config) {
  const now = Date.now();
  const windowMs = Math.max(1000, Number(config.rateLimitWindowMs || DEFAULT_RATE_LIMIT_WINDOW_MS));
  const max = Math.max(1, Number(config.rateLimitMax || DEFAULT_RATE_LIMIT_MAX));
  const tokenHash = hashShort(getProvidedToken(req) || "no-token");
  const key = `${req.socket?.remoteAddress || "unknown"}:${tokenHash}`;
  const current = config.rateLimitState.get(key);
  if (!current || current.resetAt <= now) {
    config.rateLimitState.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > max) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const error = httpError(429, "MCP rate limit exceeded.");
    error.retryAfter = retryAfter;
    throw error;
  }
}

function setCorsHeaders(req, res, allowedOrigins) {
  const origin = req.headers.origin || "";
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Second-Brain-Secret, X-MCP-Client, X-Client-Name");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function isOriginAllowed(origin, allowedOrigins = []) {
  if (!origin) return true;
  const normalized = String(origin).toLowerCase();
  return allowedOrigins.includes("*") || allowedOrigins.map((item) => item.toLowerCase()).includes(normalized);
}

function mcpResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function mcpError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function readJson(req) {
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

function sendHttpJson(res, statusCode, payload) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (payload?.error === "MCP rate limit exceeded." && payload.retryAfter) {
    headers["Retry-After"] = String(payload.retryAfter);
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload, null, 2));
}

async function writeMcpAudit(config, { req, client = "", tool, risk = "", wrote = false, ok = false, path: affectedPath = "", error = "" } = {}) {
  const entry = {
    time: new Date().toISOString(),
    remote: req?.socket?.remoteAddress || "",
    client: client || undefined,
    tool,
    risk,
    wrote: Boolean(wrote),
    ok: Boolean(ok),
    path: affectedPath || undefined,
    error: error ? String(error).slice(0, 240) : undefined
  };
  await fs.mkdir(path.dirname(config.auditLog), { recursive: true });
  await fs.appendFile(config.auditLog, `${JSON.stringify(entry)}\n`, "utf8");
}

function getMcpClientName(req, params = {}) {
  return String(
    req.headers["x-mcp-client"] ||
    req.headers["x-client-name"] ||
    params?._meta?.clientName ||
    params?.arguments?._clientName ||
    ""
  ).trim().slice(0, 80);
}

function getMcpAuditPath(result, toVaultPath) {
  const rawPath = result?.monthlyFile || result?.capture?.path || result?.path || result?.dailyFocus?.path || "";
  if (!rawPath) return "";
  if (path.isAbsolute(rawPath) && typeof toVaultPath === "function") return toVaultPath(rawPath);
  return String(rawPath);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashShort(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
