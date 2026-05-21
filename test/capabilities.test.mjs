import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  MCP_AUTH_POLICY,
  SECOND_BRAIN_CAPABILITIES,
  getMcpReadyCapabilities
} from "../src/capabilities/manifest.js";

const serverPath = new URL("../server.js", import.meta.url);

test("MCP prework manifest exposes narrow local-token capability contracts", () => {
  assert.equal(MCP_AUTH_POLICY.enabledByDefault, false);
  assert.equal(MCP_AUTH_POLICY.defaultHost, "127.0.0.1");
  assert.equal(MCP_AUTH_POLICY.tokenEnv, "MCP_TOKEN");
  assert.equal(MCP_AUTH_POLICY.fallbackTokenEnv, "APP_SECRET");

  const names = SECOND_BRAIN_CAPABILITIES.map((capability) => capability.name);
  assert.ok(names.includes("capture.append"));
  assert.ok(names.includes("tasks.create"));
  assert.ok(names.includes("sprint.current"));
  assert.ok(names.includes("dashboard.summary"));
  assert.ok(names.includes("chat.send_message"));

  const firstPassNames = getMcpReadyCapabilities().map((capability) => capability.name);
  assert.ok(firstPassNames.includes("capture.append"));
  assert.ok(firstPassNames.includes("tasks.create"));
  assert.ok(!firstPassNames.includes("chat.send_message"));
});

test("MCP HTTP endpoint exposes allowlisted tools with token auth and audit logging", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(47400 + Math.floor(Math.random() * 1000));
  const mcpPort = String(48400 + Math.floor(Math.random() * 1000));
  const secret = "test-mcp-token";
  let server;

  try {
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "fleeting"), { recursive: true });
    server = spawn(process.execPath, [serverPath.pathname], {
      cwd: path.dirname(serverPath.pathname),
      env: {
        ...process.env,
        VAULT_PATH: vaultPath,
        HOST: "127.0.0.1",
        PORT: port,
        APP_SECRET: secret,
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
        SESSION_SECRET: "",
        GITHUB_ALLOWED_LOGINS: "",
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        MCP_ENABLED: "true",
        MCP_HOST: "127.0.0.1",
        MCP_PORT: mcpPort,
        MCP_TOKEN: secret,
        MCP_ALLOWED_TOOLS: "capture.recent,tasks.create,sprint.current,dashboard.summary",
        MCP_CLIENT_TOOL_ALLOWLISTS: "test-client:capture.recent|tasks.create|sprint.current",
        MCP_ALLOWED_ORIGINS: "http://allowed.example",
        MCP_RATE_LIMIT_MAX: "20",
        MCP_AUDIT_LOG: path.join(appDataPath, "mcp-audit.jsonl")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    await waitForServer(`http://127.0.0.1:${mcpPort}/health`, {
      headers: { Authorization: `Bearer ${secret}` }
    });

    const blockedOrigin = await fetch(`http://127.0.0.1:${mcpPort}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        Origin: "http://blocked.example",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" })
    });
    assert.equal(blockedOrigin.status, 403);

    const tools = await postMcp(mcpPort, secret, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }, { "X-MCP-Client": "test-client" });
    assert.deepEqual(tools.result.tools.map((tool) => tool.name), ["capture.recent", "tasks.create", "sprint.current"]);

    const denied = await postMcp(mcpPort, secret, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "dashboard.summary", arguments: {} }
    }, { "X-MCP-Client": "test-client" });
    assert.equal(denied.error.code, -32003);
    assert.match(denied.error.message, /not allowed for this client/);

    const created = await postMcp(mcpPort, secret, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "tasks.create",
        arguments: {
          text: "MCP-created todo",
          effort: "5m"
        }
      }
    }, { "X-MCP-Client": "test-client" });
    assert.equal(created.result.structuredContent.capture.category, "todo");
    assert.match(created.result.structuredContent.capture.text, /MCP-created todo/);

    const audit = await readFile(path.join(appDataPath, "mcp-audit.jsonl"), "utf8");
    assert.match(audit, /"tool":"tasks.create"/);
    assert.match(audit, /"client":"test-client"/);
    assert.match(audit, /"wrote":true/);

    const auditStatus = await fetch(`http://127.0.0.1:${port}/api/mcp/audit`, {
      headers: { "X-Second-Brain-Secret": secret }
    });
    const auditJson = await auditStatus.json();
    assert.equal(auditStatus.status, 200);
    assert.equal(auditJson.enabled, true);
    assert.ok(auditJson.entries.some((entry) => entry.tool === "tasks.create"));
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

async function postMcp(port, token, body, extraHeaders = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function waitForServer(url, options = {}) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return;
    } catch {
      // keep trying
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready: ${url}`);
}
