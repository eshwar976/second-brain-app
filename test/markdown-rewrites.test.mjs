import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const serverPath = new URL("../server.js", import.meta.url);

test("todo capture, edit, and triage preserve Obsidian-friendly Markdown", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(46000 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
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
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const capture = await postJson(`http://127.0.0.1:${port}/api/captures`, secret, {
      category: "todo",
      text: "write test task",
      important: true,
      urgent: false,
      due: "2026-05-12"
    });

    const monthlyFile = capture.monthlyFile;
    let markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) write test task \[type:: todo] \[important:: true] \[urgent:: false] \[priority:: medium] \[due:: 2026-05-12]$/m);
    assert.doesNotMatch(markdown, /\[created::/);

    await postJson(`http://127.0.0.1:${port}/api/index/run`, secret, {});
    const tasks = await getJson(`http://127.0.0.1:${port}/api/tasks`);
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].text, "write test task");
    assert.equal(tasks.tasks[0].due, "2026-05-12");

    await postJson(`http://127.0.0.1:${port}/api/tasks/update`, secret, {
      taskId: tasks.tasks[0].id,
      text: "updated test task"
    });

    markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) updated test task \[type:: todo] \[important:: true] \[urgent:: false] \[priority:: medium] \[due:: 2026-05-12]$/m);

    const updatedTasks = await getJson(`http://127.0.0.1:${port}/api/tasks`);
    await postJson(`http://127.0.0.1:${port}/api/tasks/triage`, secret, {
      taskId: updatedTasks.tasks[0].id,
      important: false,
      urgent: true,
      due: ""
    });

    markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) updated test task \[type:: todo] \[important:: false] \[urgent:: true] \[priority:: medium]$/m);
    assert.doesNotMatch(markdown, /\[due::/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      await getJson(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not become ready.");
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function postJson(url, secret, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Second-Brain-Secret": secret
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
