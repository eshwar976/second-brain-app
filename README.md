# Second Brain App

A small local-first capture web app for appending quick notes to an Obsidian vault.

## MVP

- Runs locally on the Mac mini.
- Uses a configurable `VAULT_PATH`.
- Shows recent captures like a chat timeline.
- Appends new captures to `2.Areas/Personal/fleeting/YYYY-MM.md`.
- Adds a lightweight todo clarification sheet for importance, urgency, and optional due date.
- Builds a disposable local index under `.data/index.sqlite` for read-only search and task aggregation.
- Watches vault Markdown changes and debounces automatic index rebuilds.
- Adds a read-only vault-aware Chat MVP backed by the local SQLite index and DeepSeek API.
- Keeps app code, config, runtime data, and Git metadata outside the Obsidian vault.

## Setup

```bash
cp .env.example .env
npm start
```

Then open:

```text
http://127.0.0.1:3030
```

## Configuration

`.env` is intentionally ignored by Git.

```bash
VAULT_PATH=/Users/vamshi/Documents/obsidian/obsidian-personal
HOST=127.0.0.1
PORT=3030
WATCH_DEBOUNCE_MS=1200
AUTO_INDEX_ON_START=true
APP_SECRET=
INDEX_IGNORE=
INDEX_IGNORE_FILE=.second-brain-ignore
DEEPSEEK_API_KEY=
DEEPSEEK_REGULAR_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_THINKING=disabled
DEEPSEEK_REASONING_EFFORT=high
DEEPSEEK_TRAINING_OPT_OUT=true
CHAT_CONTEXT_LIMIT=6
CHAT_HISTORY_LIMIT=8
CHAT_SESSIONS_DIR=3.Resources/gpt/sessions
```

Set `APP_SECRET` when binding to `0.0.0.0`. When present, write actions require the passcode in the web app before they can append, edit, triage, toggle, or rebuild.

## GitHub OAuth

Replace the shared-secret passcode with GitHub OAuth for browser-based write access.

### Setup

1. Go to https://github.com/settings/developers and create a **New OAuth App**.
2. Set **Homepage URL** to `http://127.0.0.1:3030` (or your host/port).
3. Set **Authorization callback URL** to `http://127.0.0.1:3030/auth/callback`.
4. Copy the Client ID and generate a Client Secret.

### .env

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
SESSION_SECRET=a_random_secret_key
GITHUB_ALLOWED_LOGINS=your_github_login
SESSION_MAX_AGE=86400
```

All four (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `GITHUB_ALLOWED_LOGINS`) must be set to enable GitHub OAuth. `GITHUB_ALLOWED_LOGINS` is a comma-separated allowlist; only those GitHub accounts can open the vault app. When enabled, the app redirects unauthenticated browser users to GitHub's authorization page, then creates an HttpOnly session cookie on success.

`APP_SECRET` still works as a fallback when GitHub is not configured, or for CLI/curl usage where a browser redirect is impractical.

Set `DEEPSEEK_API_KEY` to enable Chat. Chat retrieves a small set of indexed vault snippets and sends those snippets, the current question, and short browser-session history to the DeepSeek API.

Chat sessions are saved as Markdown under `CHAT_SESSIONS_DIR`, which defaults to `3.Resources/gpt/sessions`. The browser remembers the active session path and reloads it after refresh.

`DEEPSEEK_REGULAR_MODEL` defaults to `deepseek-v4-flash`, which is the right default for fast daily PKM chat. `DEEPSEEK_THINKING_MODEL` defaults to `deepseek-v4-pro` for harder synthesis, project planning, coding architecture, or quality-sensitive Deep Work sessions. The Chat tab has a Thinking toggle; off sends regular Flash requests with `thinking: disabled`, while on switches to Pro and sends `thinking: enabled` with `DEEPSEEK_REASONING_EFFORT` (`high` or `max`).

`DEEPSEEK_TRAINING_OPT_OUT=true` sends a best-effort `opt_out: training` request header. This is included as a privacy preference header, but confirm current DeepSeek policy/docs for any contractual training guarantees.

## Ignore Rules

Task/search indexing can ignore vault files or folders without changing the vault.

Use either:

- `INDEX_IGNORE=4.Archive/,2.Areas/Career/private-notes/`
- or copy `.second-brain-ignore.example` to `.second-brain-ignore` and add one vault-relative path per line.

Simple `*` wildcards are supported. Ignored paths are excluded from search, task lists, dashboard counts, and watcher-triggered indexing.

## API

- `GET /api/health`
- `GET /api/config/public`
- `GET /api/captures/recent`
- `POST /api/captures`
- `GET /api/index/status`
- `POST /api/index/run`
- `GET /api/dashboard`
- `GET /api/notes/search?q=...`
- `POST /api/chat`
- `GET /api/tasks?status=open&scope=all|work|personal&focus=all|due|due-soon|high|do-now|schedule|quick|someday|triage`
- `POST /api/tasks/toggle`
- `POST /api/tasks/triage`
- `POST /api/tasks/update`
- `POST /api/captures/update`

Example capture:

```bash
curl -X POST http://127.0.0.1:3030/api/captures \
  -H 'Content-Type: application/json' \
  -d '{"category":"thought","text":"capture before it gets polished"}'
```

Example todo capture:

```bash
curl -X POST http://127.0.0.1:3030/api/captures \
  -H 'Content-Type: application/json' \
  -d '{"category":"todo","text":"schedule dentist appointment","important":true,"urgent":false,"due":"2026-05-12"}'
```

Valid categories:

- `log`
- `thought`
- `idea`
- `todo`
- `reflection`

Example chat:

```bash
curl -X POST http://127.0.0.1:3030/api/chat \
  -H 'Content-Type: application/json' \
  -H 'X-Second-Brain-Secret: your-app-passcode' \
  -d '{"message":"What have I captured recently about the PKM system?","history":[]}'
```

Chat supports three explicit context prefixes:

- `#name` loads a mentor skill from `.agents/skills/**/SKILL.md` with `type: mentor`.
- `/name` loads an assistant skill from `.agents/skills/**/SKILL.md` with `type: assistant`.
- `@name` loads a people note from `2.Areas/Personal/People/` or `3.Resources/People/` with `type: people`.

Skill files require explicit frontmatter type. The app does not infer a missing skill type.

```md
---
type: mentor
name: james-clear
---
Use long-range systems thinking and call out tradeoffs.
```

Captures are grouped by day inside the current monthly file:

```md
## 2026-05-05

- 15:32 [type:: log] initial capture app looks good. testing the actual change
- [ ] 3:35 PM follow up on PKM capture UI [type:: todo] [important:: true] [urgent:: false] [priority:: medium] [due:: 2026-05-12]
```
