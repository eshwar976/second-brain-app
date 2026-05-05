import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await loadDotEnv(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || "3030");
const VAULT_PATH = process.env.VAULT_PATH;
const PUBLIC_DIR = path.join(__dirname, "public");
const CAPTURE_CATEGORIES = new Set(["log", "thought", "idea", "todo", "reflection"]);

if (!VAULT_PATH) {
  console.error("Missing VAULT_PATH. Create .env from .env.example and set your Obsidian vault path.");
  process.exit(1);
}

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
  const entry = formatCaptureEntry({ date, category, text });
  const filePath = getCurrentMonthlyCaptureFile();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readFileIfExists(filePath);
  await fs.writeFile(filePath, appendToDaySection(existing, dayHeading, entry), "utf8");

  return {
    id: `${date.getTime()}-${category}`,
    category,
    text,
    content: entry,
    heading: dayHeading,
    timestamp: date.toISOString()
  };
}

function formatCaptureEntry({ date, category, text }) {
  const time = formatTime(date);
  if (category === "todo") {
    return formatTodo(text, date);
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [first, ...rest] = lines;
  const continuation = rest.map((line) => `  ${line}`).join("\n");
  return [`- ${time} [type:: ${category}] ${first}`, continuation].filter(Boolean).join("\n");
}

function formatTodo(text, date) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "- [ ]";
  const [first, ...rest] = lines;
  return [
    `- [ ] ${first} [type:: todo] [created:: ${formatTimestamp(date)}]`,
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
  const todoPattern = /^-\s+\[ \]\s+(.+?)\s+\[type::\s*(todo)\]\s+\[created::\s*([^\]]+)\]\s*$/;
  const typedPattern = /^-\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+\[type::\s*(log|thought|idea|reflection)\]\s+(.+?)\s*$/i;

  const todoMatch = line.match(todoPattern);
  if (todoMatch) {
    return {
      id: `${todoMatch[3]}-todo-${todoMatch[1].length}`,
      heading: `## ${day}`,
      label: todoMatch[3],
      category: "todo",
      text: todoMatch[1].trim(),
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
