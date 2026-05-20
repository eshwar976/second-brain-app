import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
        SESSION_SECRET: "",
        GITHUB_ALLOWED_LOGINS: "",
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const ignoreRules = await postJson(`http://127.0.0.1:${port}/api/settings/ignore-rules`, secret, {
      rules: "4.Archive\n3.Resources"
    });
    assert.deepEqual(ignoreRules.rules, ["4.Archive", "3.Resources"]);
    const ignoreMarkdown = await readFile(path.join(appDataPath, ".second-brain-ignore"), "utf8");
    assert.match(ignoreMarkdown, /4\.Archive/);
    assert.match(ignoreMarkdown, /3\.Resources/);

    const capture = await postJson(`http://127.0.0.1:${port}/api/captures`, secret, {
      category: "todo",
      text: "write test task",
      important: true,
      urgent: false,
      due: "2026-05-12",
      effort: "5m"
    });

    const monthlyFile = capture.monthlyFile;
    let markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) write test task \[type:: todo] \[important:: true] \[urgent:: false] \[priority:: medium] \[due:: 2026-05-12] \[effort:: 5m]$/m);
    assert.doesNotMatch(markdown, /\[created::/);

    await postJson(`http://127.0.0.1:${port}/api/index/run`, secret, {});
    const tasks = await getJson(`http://127.0.0.1:${port}/api/tasks`, secret);
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].text, "write test task");
    assert.equal(tasks.tasks[0].due, "2026-05-12");
    assert.equal(tasks.tasks[0].effort, "5m");

    await postJson(`http://127.0.0.1:${port}/api/tasks/update`, secret, {
      taskId: tasks.tasks[0].id,
      text: "updated test task"
    });

    markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) updated test task \[type:: todo] \[important:: true] \[urgent:: false] \[priority:: medium] \[due:: 2026-05-12] \[effort:: 5m]$/m);

    const updatedTasks = await getJson(`http://127.0.0.1:${port}/api/tasks`, secret);
    await postJson(`http://127.0.0.1:${port}/api/tasks/triage`, secret, {
      taskId: updatedTasks.tasks[0].id,
      important: false,
      urgent: true,
      due: "",
      effort: ""
    });

    markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) updated test task \[type:: todo] \[important:: false] \[urgent:: true] \[priority:: medium]$/m);
    assert.doesNotMatch(markdown, /\[due::/);
    assert.doesNotMatch(markdown, /\[effort::/);

    await postJson(`http://127.0.0.1:${port}/api/captures`, secret, {
      category: "todo",
      text: "quick five minute task",
      important: false,
      urgent: false,
      effort: "5m"
    });

    markdown = await readFile(monthlyFile, "utf8");
    assert.match(markdown, /^- \[ \] \d{1,2}:\d{2} (?:AM|PM) quick five minute task \[type:: todo] \[important:: false] \[urgent:: false] \[priority:: low] \[effort:: 5m]$/m);
    assert.doesNotMatch(markdown.match(/^.*quick five minute task.*$/m)?.[0] || "", /\[due::/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("recent capture display hides inline metadata fields", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(46500 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
  let server;

  try {
    const fleetingDir = path.join(vaultPath, "2.Areas", "Personal", "fleeting");
    await mkdir(fleetingDir, { recursive: true });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const day = `${month}-${String(now.getDate()).padStart(2, "0")}`;
    await writeFile(path.join(fleetingDir, `${month}.md`), [
      `## ${day}`,
      "- 5:55 PM [type:: log] [domain:: finance] [activity:: learning] [source:: [[3.Resources/Sources/die-with-zero|Die With Zero]]] Read a useful chapter",
      "- 6:10 PM [type:: thought] [[domain:: hobbies]] [activity:: reflection] Build more with less setup"
    ].join("\n"), "utf8");

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
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    const recent = await getJson(`http://127.0.0.1:${port}/api/captures/recent?limit=5`, secret);
    assert.equal(recent.captures.length, 2);
    assert.equal(recent.captures[0].displayText, "Build more with less setup");
    assert.equal(recent.captures[1].displayText, "Read a useful chapter");
    assert.match(recent.captures[1].content, /\[activity:: learning]/);
    assert.doesNotMatch(recent.captures[1].displayText, /\[(?:domain|activity|source)::/);
    assert.doesNotMatch(recent.captures[0].displayText, /\[\[domain::/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("chat context suggestions prioritize intent-matched vault files over generic skills", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(46000 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
  let server;

  try {
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "sprints"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "Ideas"), { recursive: true });
    await mkdir(path.join(vaultPath, ".agents", "skills", "personal-idea-evaluator"), { recursive: true });
    await mkdir(path.join(vaultPath, ".agents", "skills", "okr-planner"), { recursive: true });
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "personal-Q1-FY2027.md"), [
      "---",
      "title: Personal Q1 FY2027 OKRs",
      "type: okr",
      "---",
      "# Personal Q1 FY2027 OKRs",
      "",
      "## Objectives",
      "- Build a calm personal operating system."
    ].join("\n"));
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "sprints", "sprint-2026-05-11.md"), [
      "---",
      "title: Sprint 2026-05-11",
      "type: sprint",
      "---",
      "# Sprint 2026-05-11"
    ].join("\n"));
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "Ideas", "idea-ledger.md"), [
      "# Idea Ledger",
      "",
      "## Active (1 slot only)",
      "| Idea | Done Looks Like | Started |",
      "|---|---|---|"
    ].join("\n"));
    await writeFile(path.join(vaultPath, ".agents", "skills", "personal-idea-evaluator", "SKILL.md"), [
      "---",
      "name: personal-idea-evaluator",
      "description: Evaluate personal ideas.",
      "---",
      "# Personal Idea Evaluator"
    ].join("\n"));
    await writeFile(path.join(vaultPath, ".agents", "skills", "okr-planner", "SKILL.md"), [
      "---",
      "name: okr-planner",
      "description: Help plan and review OKRs.",
      "---",
      "# OKR Planner"
    ].join("\n"));

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
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    await postJson(`http://127.0.0.1:${port}/api/index/run`, secret, {});

    const context = await getJson(`http://127.0.0.1:${port}/api/chat/context-suggestions?q=${encodeURIComponent("what are my personal okrs")}`, secret);
    assert.equal(context.suggestions[0].kind, "file");
    assert.match(context.suggestions[0].path, /2\.Areas\/Personal\/OKRs\/FY2027\/Q1\/personal-Q1-FY2027\.md/);
    assert.notEqual(context.suggestions[0].token, "personal-idea-evaluator");

    const filePicker = await getJson(`http://127.0.0.1:${port}/api/chat/references?kind=file&q=okr`, secret);
    assert.match(filePicker.suggestions[0].path, /2\.Areas\/Personal\/OKRs\/FY2027\/Q1\/personal-Q1-FY2027\.md/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("dashboard reads personal checklist cadence state", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(46600 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
  let server;

  try {
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "System"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "fleeting"), { recursive: true });
    const today = localDateSlug();
    const oldDate = localDateSlug(addTestDays(new Date(), -40));
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "System", "checklist-state.md"), [
      "---",
      "title: Personal Checklist State",
      `last-fleeting-classification: \"${today}\"`,
      `last-biweekly-priority: \"${oldDate}\"`,
      `last-monthly-drift-check: \"${today}\"`,
      "last-monthly-curation: \"\"",
      "last-vision-review: \"\"",
      "last-okr-scoring: \"\"",
      "---",
      "# Personal Checklist State"
    ].join("\n"), "utf8");

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
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    const dashboard = await getJson(`http://127.0.0.1:${port}/api/dashboard`, secret);
    assert.equal(dashboard.personalSystem.available, true);
    assert.equal(dashboard.personalSystem.statePath, "2.Areas/Personal/System/checklist-state.md");
    assert.equal(dashboard.personalSystem.systemPath, "2.Areas/Personal/System/Personal System.md");
    assert.equal(dashboard.personalSystem.items.find((item) => item.key === "last-fleeting-classification").status, "current");
    assert.equal(dashboard.personalSystem.items.find((item) => item.key === "last-biweekly-priority").status, "overdue");
    assert.equal(dashboard.personalSystem.items.find((item) => item.key === "last-monthly-curation").status, "not-run");
    assert.equal(dashboard.personalSystem.items.find((item) => item.key === "last-monthly-curation").actionPrompt, "review my fleeting notes");
    assert.equal(dashboard.personalSystem.attentionCount, 4);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("personal sprint reads OKRs, counts activity logs, and updates weekly checkbox frontmatter", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(47000 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
  let server;

  try {
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "sprints"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q0", "sprints"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q2", "sprints"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "Ideas", "secondbrain-webapp"), { recursive: true });
    await mkdir(path.join(vaultPath, "2.Areas", "Personal", "fleeting"), { recursive: true });
    const sprintPath = path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "sprints", "sprint-2026-05-11.md");
    const okrPath = path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "personal-Q1-FY2027.md");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q1", "sprint-state-Q1-FY2027.md"), [
      "---",
      "title: Personal Sprint Index — Q1 FY2027",
      "quarter: Q1-FY2027",
      "current-sprint: \"sprint-2026-05-11\"",
      "---",
      "# Sprint Index",
      "",
      "| Sprint | File | Status | Outcome |",
      "|--------|------|--------|---------|",
      "| May 11–25 | [[sprints/sprint-2026-05-11]] | active | |"
    ].join("\n"), "utf8");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q0", "sprints", "sprint-2026-04-01.md"), [
      "---",
      "title: Old Sprint Plan",
      "quarter: Q0-FY2027",
      "sprint-start: \"2026-04-01\"",
      "sprint-end: \"2026-04-10\"",
      "active-kr: \"9.9\"",
      "okr-file: \"2.Areas/Personal/OKRs/FY2027/Q1/personal-Q1-FY2027.md\"",
      "---",
      "# Old Sprint"
    ].join("\n"), "utf8");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "OKRs", "FY2027", "Q2", "sprints", "sprint-2026-08-03.md"), [
      "---",
      "title: Next Sprint Plan",
      "quarter: Q2-FY2027",
      "sprint-start: \"2026-08-03\"",
      "sprint-end: \"2026-08-17\"",
      "active-kr: \"1.1\"",
      "okr-file: \"2.Areas/Personal/OKRs/FY2027/Q1/personal-Q1-FY2027.md\"",
      "---",
      "# Next Sprint"
    ].join("\n"), "utf8");
    await writeFile(sprintPath, [
      "---",
      "title: Personal Sprint — May 11–25, 2026",
      "quarter: Q1-FY2027",
      "sprint-start: \"2026-05-11\"",
      "sprint-end: \"2026-05-25\"",
      "active-kr: \"1.3\"",
      "active-kr-description: \"Apply psoriasis ointment consistently\"",
      "active-kr-type: habit",
      "active-kr-activity: ointment",
      "weekly-checkboxes:",
      "  - week: \"2026-05-11\"",
      "    label: \"Week of May 11\"",
      "    done: false",
      "  - week: \"2026-05-18\"",
      "    label: \"Week of May 18\"",
      "    done: false",
      "okr-file: \"2.Areas/Personal/OKRs/FY2027/Q1/personal-Q1-FY2027.md\"",
      "---",
      "# Sprint"
    ].join("\n"), "utf8");
    await writeFile(okrPath, [
      "---",
      "title: Personal OKRs — Q1 FY2027",
      "quarter: Q1-FY2027",
      "status: active",
      "key-results:",
      "  - id: \"1.1\"",
      "    objective: 1",
      "    objective-title: \"Establish health baseline\"",
      "    description: \"Go to the gym at least 3x/week\"",
      "    type: frequency",
      "    target: 3",
      "    unit: sessions/week",
      "    activity: gym",
      "    status: in-progress",
      "  - id: \"1.3\"",
      "    objective: 1",
      "    objective-title: \"Establish health baseline\"",
      "    description: \"Apply psoriasis ointment consistently\"",
      "    type: habit",
      "    activity: ointment",
      "    status: in-progress",
      "  - id: \"1.4\"",
      "    objective: 1",
      "    objective-title: \"Establish health baseline\"",
      "    description: \"Schedule annual physical\"",
      "    type: milestone",
      "    activity: annual-physical",
      "    status: done",
      "---",
      "# OKRs"
    ].join("\n"), "utf8");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "fleeting", "2026-05.md"), [
      "## 2026-05-10",
      "- 8:00 PM [activity:: ointment] before sprint",
      "",
      "## 2026-05-11",
      "- 8:00 PM [activity:: ointment] first",
      "",
      "## 2026-05-12",
      "- 8:00 PM [activity:: ointment] second",
      "- 9:00 PM [activity:: gym] lift",
      "",
      "## 2026-05-19",
      "- 9:00 PM [activity:: gym] current week lift",
      "",
      "## 2026-05-26",
      "- 8:00 PM [activity:: ointment] after sprint"
    ].join("\n"), "utf8");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "Ideas", "idea-ledger.md"), [
      "# Idea Ledger",
      "",
      "## 🔴 Active (1 slot only)",
      "",
      "| Idea | Done Looks Like | Started |",
      "|------|----------------|---------|",
      "| [SecondBrain Webapp](Ideas/secondbrain-webapp/idea.md) | Focus tab visible between sprint and OKRs | 2026-05-12 |"
    ].join("\n"), "utf8");
    await writeFile(path.join(vaultPath, "2.Areas", "Personal", "Ideas", "secondbrain-webapp", "idea.md"), "# SecondBrain Webapp\n", "utf8");

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
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore"),
        PERSONAL_OKR_ROOT: "2.Areas/Personal/OKRs",
        PERSONAL_SPRINT_STATE_PATH: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const sprint = await getJson(`http://127.0.0.1:${port}/api/personal-sprint`, secret);
    assert.equal(sprint.sprint.path, "2.Areas/Personal/OKRs/FY2027/Q1/sprints/sprint-2026-05-11.md");
    assert.equal(sprint.sprint.selection, "active-by-date");
    assert.equal(sprint.sprint.candidateCount, 3);
    assert.deepEqual(sprint.sprint.availableViews.map((item) => item.view), ["last", "current", "next"]);
    assert.equal(sprint.sprint.activeKr, "1.3");
    assert.equal(sprint.sprint.activeActivityCount, 2);
    assert.deepEqual(sprint.sprint.activeProgress, {
      kind: "habit",
      count: 2,
      current: 2,
      target: 15,
      percent: 13,
      label: "2/15 days logged"
    });
    assert.equal(sprint.focus.available, true);
    assert.equal(sprint.focus.title, "SecondBrain Webapp");
    assert.equal(sprint.focus.doneLooksLike, "Focus tab visible between sprint and OKRs");
    assert.equal(sprint.focus.ideaPath, "2.Areas/Personal/Ideas/secondbrain-webapp/idea.md");
    assert.equal(sprint.focus.ledgerPath, "2.Areas/Personal/Ideas/idea-ledger.md");
    assert.equal(sprint.okr.objectives.length, 1);
    assert.equal(sprint.okr.objectives[0].keyResults[0].progress.current, 1);
    assert.equal(sprint.okr.objectives[0].keyResults[0].progress.target, 3);
    assert.equal(sprint.okr.objectives[0].keyResults[0].progress.percent, 33);
    assert.equal(sprint.okr.objectives[0].keyResults[1].progress.current, 2);
    assert.equal(sprint.okr.objectives[0].keyResults[1].progress.target, 15);
    assert.equal(sprint.okr.objectives[0].keyResults[1].progress.percent, 13);
    assert.equal(sprint.okr.objectives[0].keyResults[2].progress.current, 1);
    assert.equal(sprint.okr.objectives[0].keyResults[2].progress.target, 1);
    assert.equal(sprint.okr.objectives[0].keyResults[2].progress.percent, 100);

    const lastSprint = await getJson(`http://127.0.0.1:${port}/api/personal-sprint?view=last`, secret);
    assert.equal(lastSprint.sprint.path, "2.Areas/Personal/OKRs/FY2027/Q0/sprints/sprint-2026-04-01.md");
    assert.equal(lastSprint.sprint.view, "last");
    assert.equal(lastSprint.sprint.review.incompleteActiveKr, false);
    assert.equal(lastSprint.sprint.review.uncheckedWeekCount, 0);

    const nextSprint = await getJson(`http://127.0.0.1:${port}/api/personal-sprint?view=next`, secret);
    assert.equal(nextSprint.sprint.path, "2.Areas/Personal/OKRs/FY2027/Q2/sprints/sprint-2026-08-03.md");
    assert.equal(nextSprint.sprint.view, "next");
    assert.equal(nextSprint.sprint.preview.plannedWeekCount, 0);
    assert.ok(nextSprint.sprint.preview.startsInDays > 0);

    await postJson(`http://127.0.0.1:${port}/api/personal-sprint/checkbox`, secret, {
      week: "2026-05-11",
      done: true
    });

    const markdown = await readFile(sprintPath, "utf8");
    assert.match(markdown, /week: "2026-05-11"\n\s+label: "Week of May 11"\n\s+done: true/);
    assert.match(markdown, /week: "2026-05-18"\n\s+label: "Week of May 18"\n\s+done: false/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("deep work creates separate session files and captures ending recap", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(48000 + Math.floor(Math.random() * 1000));
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
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
        SESSION_SECRET: "",
        GITHUB_ALLOWED_LOGINS: "",
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore"),
        CHAT_SESSIONS_DIR: "3.Resources/gpt/sessions",
        DEEP_WORK_SESSIONS_DIR: "3.Resources/gpt/sessions/deep-work"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const started = await postJson(`http://127.0.0.1:${port}/api/deep-work/start`, secret, {
      goal: "Finish phase four deep work"
    });
    assert.match(started.path, /^3\.Resources\/gpt\/sessions\/deep-work\/.+\.md$/);

    const deepWorkPath = path.join(vaultPath, started.path);
    let markdown = await readFile(deepWorkPath, "utf8");
    assert.match(markdown, /type: deep-work-session/);
    assert.match(markdown, /## Context/);
    assert.match(markdown, /## Conversation/);
    assert.match(markdown, /## Decisions/);
    assert.match(markdown, /## Tasks/);
    assert.match(markdown, /## Recap/);

    await postJson(`http://127.0.0.1:${port}/api/deep-work/stop`, secret, {
      sessionPath: started.path,
      recap: "Decided to keep Deep Work files separate from old chat sessions.",
      captureReflection: true
    });

    markdown = await readFile(deepWorkPath, "utf8");
    assert.match(markdown, /status: completed/);
    assert.match(markdown, /## Recap[\s\S]*Decided to keep Deep Work files separate/);

    const fleeting = await readFile(path.join(vaultPath, "2.Areas", "Personal", "fleeting", "2026-05.md"), "utf8");
    assert.match(fleeting, /\[type:: reflection]/);
    assert.match(fleeting, /\[source:: \[\[3\.Resources\/gpt\/sessions\/deep-work\//);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("monthly fleeting review creates a separate draft without changing the raw log", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(49000 + Math.floor(Math.random() * 1000));
  const secret = "test-passcode";
  let server;

  try {
    const fleetingDir = path.join(vaultPath, "2.Areas", "Personal", "fleeting");
    await mkdir(fleetingDir, { recursive: true });
    const monthlyPath = path.join(fleetingDir, "2026-05.md");
    const rawLog = [
      "## 2026-05-14",
      "- 8:00 AM [type:: thought] Review workflow should preserve the raw log",
      "- 9:00 AM [activity:: ointment] health habit"
    ].join("\n");
    await writeFile(monthlyPath, rawLog, "utf8");

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
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore"),
        CHAT_PROVIDER: "deepseek",
        DEEPSEEK_API_KEY: "test-key",
        TEST_AI_JSON: JSON.stringify({
          title: "Fleeting Review — 2026-05",
          summary: "May notes show a review workflow and health habit thread.",
          tags: ["gpt/review", "fleeting"],
          body: "## Themes\n\n- Review workflow\n- Health habit\n\n## Next actions\n\n- Decide review cadence"
        })
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const result = await postJson(`http://127.0.0.1:${port}/api/reviews/monthly-fleeting`, secret, {
      month: "2026-05"
    });

    assert.equal(result.review.path, "3.Resources/gpt/reviews/fleeting/2026-05-fleeting-review.md");
    const review = await readFile(path.join(vaultPath, result.review.path), "utf8");
    assert.match(review, /type: monthly-fleeting-review/);
    assert.match(review, /month: "2026-05"/);
    assert.match(review, /Source: \[\[2\.Areas\/Personal\/fleeting\/2026-05\.md]]/);
    assert.match(review, /May notes show a review workflow/);

    const rawAfter = await readFile(monthlyPath, "utf8");
    assert.equal(rawAfter, rawLog);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("protected endpoints reject unauthenticated requests", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(50000 + Math.floor(Math.random() * 1000));
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
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
        SESSION_SECRET: "",
        GITHUB_ALLOWED_LOGINS: "",
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks`);
    const data = await response.json();
    assert.equal(response.status, 401);
    assert.equal(data.error, "App passcode required.");
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("github oauth rejects non-allowlisted accounts without network calls", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(51000 + Math.floor(Math.random() * 1000));
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
        APP_SECRET: "",
        GITHUB_CLIENT_ID: "test-client",
        GITHUB_CLIENT_SECRET: "test-secret",
        SESSION_SECRET: "test-session-secret",
        GITHUB_ALLOWED_LOGINS: "allowed-user",
        TEST_GITHUB_USER_JSON: JSON.stringify({
          id: 123,
          login: "intruder",
          name: "Intruder",
          avatar_url: "https://example.invalid/avatar.png"
        }),
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    const loginResponse = await fetch(`http://127.0.0.1:${port}/auth/login`, { redirect: "manual" });
    assert.equal(loginResponse.status, 302);
    const location = loginResponse.headers.get("location") || "";
    const state = new URL(location).searchParams.get("state");
    assert.ok(state);

    const callback = await fetch(`http://127.0.0.1:${port}/auth/callback?code=test-code&state=${encodeURIComponent(state)}`, { redirect: "manual" });
    const data = await callback.json();
    assert.equal(callback.status, 403);
    assert.equal(data.error, "This GitHub account is not allowed to access this vault.");
    assert.doesNotMatch(callback.headers.get("set-cookie") || "", /sb_session=/);
  } finally {
    if (server) server.kill("SIGTERM");
    await rm(vaultPath, { recursive: true, force: true });
    await rm(appDataPath, { recursive: true, force: true });
  }
});

test("github oauth config fails startup without an allowlist", async () => {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-vault-"));
  const appDataPath = await mkdtemp(path.join(os.tmpdir(), "second-brain-data-"));
  const port = String(52000 + Math.floor(Math.random() * 1000));
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
        APP_SECRET: "",
        GITHUB_CLIENT_ID: "test-client",
        GITHUB_CLIENT_SECRET: "test-secret",
        SESSION_SECRET: "test-session-secret",
        GITHUB_ALLOWED_LOGINS: "",
        AUTO_INDEX_ON_START: "false",
        DATA_DIR: appDataPath,
        INDEX_IGNORE_FILE: path.join(appDataPath, ".second-brain-ignore")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const { code, stderr } = await waitForExit(server);
    server = null;
    assert.equal(code, 1);
    assert.match(stderr, /GITHUB_ALLOWED_LOGINS/);
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

function waitForExit(child) {
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve({ code, stderr }));
  });
}

function localDateSlug(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addTestDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function getJson(url, secret = "") {
  const response = await fetch(url, {
    headers: secret ? { "X-Second-Brain-Secret": secret } : {}
  });
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
