import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await loadDotEnv(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || "3030");
const VAULT_PATH = process.env.VAULT_PATH;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, ".data");
const DB_PATH = path.join(DATA_DIR, "index.sqlite");
const SQLITE_BIN = process.env.SQLITE_BIN || "/usr/bin/sqlite3";
const CAPTURE_CATEGORIES = new Set(["log", "thought", "idea", "todo", "reflection"]);
const SKIPPED_DIRS = new Set([".obsidian", ".git", ".trash", ".agents", "node_modules", ".data"]);
const SKIPPED_PATH_PARTS = new Set(["attachments", "credentials"]);
const SENSITIVE_PATH_PATTERN = /(?:password|passwd|secret|token|credential|api[-_ ]?key|private[-_ ]?key)/i;

if (!VAULT_PATH) {
  console.error("Missing VAULT_PATH. Create .env from .env.example and set your Obsidian vault path.");
  process.exit(1);
}

await ensureIndexSchema();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      return sendJson(res, 200, await getHealth());
    }

    if (url.pathname === "/api/config/public" && req.method === "GET") {
      return sendJson(res, 200, await getPublicConfig());
    }

    if (url.pathname === "/api/captures/recent" && req.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || "12"), 50);
      const captures = await readRecentCaptures(limit);
      return sendJson(res, 200, { captures, monthlyFile: getCurrentMonthlyCaptureFile() });
    }

    if (url.pathname === "/api/captures" && req.method === "POST") {
      const body = await readRequestJson(req);
      const capture = await appendCapture(body);
      return sendJson(res, 201, { capture, monthlyFile: getCurrentMonthlyCaptureFile() });
    }

    if (url.pathname === "/api/index/status" && req.method === "GET") {
      return sendJson(res, 200, await getIndexStatus());
    }

    if (url.pathname === "/api/index/run" && req.method === "POST") {
      return sendJson(res, 200, await runVaultIndex());
    }

    if (url.pathname === "/api/dashboard" && req.method === "GET") {
      return sendJson(res, 200, await getDashboard());
    }

    if (url.pathname === "/api/notes/search" && req.method === "GET") {
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
      return sendJson(res, 200, await searchNotes(query, limit));
    }

    if (url.pathname === "/api/tasks" && req.method === "GET") {
      const status = url.searchParams.get("status") || "open";
      const scope = url.searchParams.get("scope") || "all";
      const focus = url.searchParams.get("focus") || "all";
      const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 200);
      return sendJson(res, 200, await getTasks({ status, scope, focus, limit }));
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

server.listen(PORT, HOST, () => {
  console.log(`Second Brain App running at http://${HOST}:${PORT}`);
  console.log(`Vault path: ${VAULT_PATH}`);
});

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
      dbPath: DB_PATH
    }
  };
}

async function getPublicConfig() {
  return {
    appName: "Second Brain Capture",
    vaultName: path.basename(VAULT_PATH),
    currentMonth: getCurrentMonthSlug(),
    monthlyFile: getCurrentMonthlyCaptureFile(),
    categories: Array.from(CAPTURE_CATEGORIES)
  };
}

async function ensureIndexSchema() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await dbExec(`
    CREATE TABLE IF NOT EXISTS notes_metadata (
      note_id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
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
}

async function ensureTaskColumn(columnName) {
  try {
    await dbExec(`ALTER TABLE tasks ADD COLUMN ${columnName} TEXT;`);
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
    dbPath: DB_PATH
  };
}

async function runVaultIndex() {
  const started = Date.now();
  const markdownFiles = [];
  const skipped = { count: 0 };

  await collectMarkdownFiles(VAULT_PATH, markdownFiles, skipped);

  const notes = [];
  const tasks = [];
  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, "utf8");
    const stat = await fs.stat(filePath);
    const note = parseMarkdownNote({ filePath, markdown, stat });
    notes.push(note);
    tasks.push(...extractTasks(note, markdown));
  }

  const now = new Date().toISOString();
  const sql = [
    "BEGIN;",
    "DELETE FROM notes_metadata;",
    "DELETE FROM tasks;",
    ...notes.map((note) => `
      INSERT INTO notes_metadata (
        note_id, path, title, para, project, created, updated, tags, headings, snippet, content
      ) VALUES (
        ${sqlValue(note.noteId)}, ${sqlValue(note.path)}, ${sqlValue(note.title)}, ${sqlValue(note.para)},
        ${sqlValue(note.project)}, ${sqlValue(note.created)}, ${sqlValue(note.updated)}, ${sqlValue(note.tags)},
        ${sqlValue(note.headings)}, ${sqlValue(note.snippet)}, ${sqlValue(note.content)}
      );
    `),
    ...tasks.map((task) => `
      INSERT INTO tasks (
        task_id, note_id, path, line_number, status, text, priority, due, important, urgent, project, context, updated
      ) VALUES (
        ${sqlValue(task.taskId)}, ${sqlValue(task.noteId)}, ${sqlValue(task.path)}, ${task.lineNumber},
        ${sqlValue(task.status)}, ${sqlValue(task.text)}, ${sqlValue(task.priority)}, ${sqlValue(task.due)},
        ${sqlValue(task.important)}, ${sqlValue(task.urgent)}, ${sqlValue(task.project)}, ${sqlValue(task.context)},
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
    ranAt: now,
    noteCount: notes.length,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => task.status === "open").length,
    skippedCount: skipped.count,
    durationMs: Date.now() - started,
    dbPath: DB_PATH
  };
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

async function getDashboard() {
  await ensureIndexSchema();
  const [status, recentNotes, captures, highFocusTasks, dueSoonTasks, triageTasks] = await Promise.all([
    getIndexStatus(),
    searchNotes("", 6),
    readRecentCaptures(5),
    getTasks({ status: "open", scope: "all", focus: "high", limit: 5 }),
    getTasks({ status: "open", scope: "all", focus: "due-soon", limit: 5 }),
    getTasks({ status: "open", scope: "all", focus: "triage", limit: 5 })
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
    recentCaptures: captures,
    recentNotes: recentNotes.results,
    highFocusTasks: highFocusTasks.tasks,
    dueSoonTasks: dueSoonTasks.tasks,
    triageTasks: triageTasks.tasks
  };
}

async function getTasks({ status = "open", scope = "all", focus = "all", limit = 100 } = {}) {
  await ensureIndexSchema();
  const normalizedStatus = ["open", "done", "all"].includes(status) ? status : "open";
  const normalizedScope = ["all", "work", "personal"].includes(scope) ? scope : "all";
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
  const whereClause = buildTaskWhereClause({ status: normalizedStatus, scope: normalizedScope, focus: normalizedFocus });
  const countRows = await dbQuery(`
    SELECT COUNT(*) AS total_count
    FROM tasks
    ${whereClause}
  `);
  const rows = await dbQuery(`
    SELECT task_id, note_id, path, line_number, status, text, priority, due, important, urgent, project, context, updated
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

function buildTaskWhereClause({ status, scope, focus }) {
  const clauses = [];
  const dueSoonCutoff = formatDate(addDays(new Date(), 7));
  if (status !== "all") clauses.push(`status = ${sqlValue(status)}`);
  if (scope === "work") {
    clauses.push(`(path LIKE '2.Areas/Career/%' OR path LIKE '1.Projects/%' OR path LIKE '4.Archive/work/%')`);
  }
  if (scope === "personal") {
    clauses.push(`(path LIKE '2.Areas/Personal/%' OR path LIKE '1.Projects/columbus/%')`);
  }
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
  const segments = relativePath.split("/").filter(Boolean);
  if (entry.isDirectory() && (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith("."))) return true;
  if (segments.some((segment) => SKIPPED_PATH_PARTS.has(segment.toLowerCase()))) return true;
  return SENSITIVE_PATH_PATTERN.test(relativePath);
}

function parseMarkdownNote({ filePath, markdown, stat }) {
  const relativePath = toVaultPath(filePath);
  const { frontmatter, body } = splitFrontmatter(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const title = metadata.title || findFirstHeading(body) || path.basename(filePath, ".md");
  const para = metadata.para || inferPara(relativePath);
  const project = metadata.project || inferProject(relativePath, para);
  const headings = JSON.stringify(extractHeadings(body));
  const tags = JSON.stringify(extractTags(markdown, metadata.tags));
  const content = normalizeMarkdown(body);

  return {
    noteId: hash(relativePath),
    path: relativePath,
    title,
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
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
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

function cleanTaskText(value) {
  return stripMarkdown(
    String(value)
      .replace(/\[[A-Za-z0-9_-]+::\s*[^\]]+]/g, "")
      .replace(/\b[A-Za-z0-9_-]+::\s+\S+/g, "")
      .replace(/\s+/g, " ")
  );
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
  const entry = formatCaptureEntry({ date, category, text, todo });
  const filePath = getCurrentMonthlyCaptureFile();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readFileIfExists(filePath);
  await fs.writeFile(filePath, appendToDaySection(existing, dayHeading, entry), "utf8");

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

function formatCaptureEntry({ date, category, text, todo = null }) {
  const time = formatTime(date);
  if (category === "todo") {
    return formatTodo(text, date, todo);
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [first, ...rest] = lines;
  const continuation = rest.map((line) => `  ${line}`).join("\n");
  return [`- ${time} [type:: ${category}] ${first}`, continuation].filter(Boolean).join("\n");
}

function normalizeTodoCaptureMetadata(body) {
  const important = parseBooleanInput(body?.important);
  const urgent = parseBooleanInput(body?.urgent);
  const due = String(body?.due || "").trim();

  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    throw httpError(400, "Due date must use YYYY-MM-DD.");
  }

  return {
    important,
    urgent,
    due: due || "",
    priority: derivePriority({ important: String(important), urgent: String(urgent) })
  };
}

function parseBooleanInput(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return false;
}

function formatTodo(text, date, metadata = null) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "- [ ]";
  const [first, ...rest] = lines;
  const fields = [
    "[type:: todo]",
    metadata ? `[important:: ${metadata.important ? "true" : "false"}]` : "",
    metadata ? `[urgent:: ${metadata.urgent ? "true" : "false"}]` : "",
    metadata?.priority ? `[priority:: ${metadata.priority}]` : "",
    metadata?.due ? `[due:: ${metadata.due}]` : "",
    `[created:: ${formatTimestamp(date)}]`
  ].filter(Boolean).join(" ");

  return [
    `- [ ] ${first} ${fields}`,
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
        lastCapture.content = `${lastCapture.content}\n${line}`;
      }
    }
  }

  if (currentOldCapture) captures.push(finalizeOldCapture(currentOldCapture));
  return captures.slice(-limit).reverse();
}

function finalizeOldCapture(capture) {
  const content = capture.lines.join("\n").trim();
  return {
    id: `${capture.label}-${capture.category}-${content.length}`,
    heading: capture.heading,
    label: capture.label,
    category: capture.category,
    text: content.replace(/^- \[ \]\s*/, "").trim(),
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
      const label = metadata.created || `${day} ${formatTimeFromDateString(day)}`;
      const important = normalizeBooleanString(metadata.important);
      const urgent = normalizeBooleanString(metadata.urgent);
      return {
        id: `${label}-todo-${text.length}`,
        heading: `## ${day}`,
        label,
        category: "todo",
        text,
        content: line.trim(),
        metadata: {
          important: important === "true",
          urgent: urgent === "true",
          priority: metadata.priority || derivePriority({ important, urgent }) || "",
          due: metadata.due || ""
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
      content: line.trim()
    };
  }

  const typedMatch = line.match(typedPattern);
  if (typedMatch) {
    const label = `${day} ${typedMatch[1]}`;
    return {
      id: `${label}-${typedMatch[2]}-${typedMatch[3].length}`,
      heading: `## ${day}`,
      label,
      category: typedMatch[2],
      text: typedMatch[3].trim(),
      content: line.trim()
    };
  }

  return null;
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
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
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
