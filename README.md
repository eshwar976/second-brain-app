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

## Mac Mini Service

For always-on Mac mini use, install the native `launchd` service:

```bash
npm run service:install
```

This starts the web app and, by default, starts Hermes HTTP from the configured vault path.

Useful commands:

```bash
npm run service:status
npm run service:logs
npm run service:uninstall
```

Details are in [docs/mac-mini-service.md](docs/mac-mini-service.md).

The full operator guide is [docs/operations-runbook.md](docs/operations-runbook.md).

For routine checks and recovery steps, use [docs/maintenance-checklist.md](docs/maintenance-checklist.md).

For repo/vault boundaries and backup hygiene, use [docs/repo-and-backup-hygiene.md](docs/repo-and-backup-hygiene.md).

For quarter-level habit tracking in Dashboard, use [docs/okr-habit-format.md](docs/okr-habit-format.md).

For the planned Hermes runtime and LLM Wiki architecture, use [docs/hermes-llm-wiki-plan.md](docs/hermes-llm-wiki-plan.md).

For MCP client setup, use [docs/mcp-client-setup.md](docs/mcp-client-setup.md).

For the future MCP architecture and security model, use [docs/mcp-future-plan.md](docs/mcp-future-plan.md).

When `MCP_ENABLED=true`, the app also starts a token-protected MCP HTTP endpoint at `/mcp` on `MCP_PORT` for trusted internal-network clients.

Quick local diagnosis:

```bash
npm run doctor
```

## Configuration

`.env` is intentionally ignored by Git.

```bash
VAULT_PATH=/Users/vamshi/Documents/obsidian/obsidian-personal
HOST=127.0.0.1
PORT=3030
WATCH_DEBOUNCE_MS=1200
ICLOUD_WATCH_DEBOUNCE_MS=15000
ICLOUD_STARTUP_INDEX_DELAY_MS=30000
ICLOUD_READ_RETRY_COUNT=3
MAX_INDEX_READ_ERROR_LOGS=10
AUTO_INDEX_ON_START=true
VAULT_WATCH_ENABLED=false
NIGHTLY_INDEX_ENABLED=true
NIGHTLY_INDEX_HOUR=3
NIGHTLY_INDEX_MINUTE=15
APP_SECRET=
INDEX_IGNORE=
INDEX_IGNORE_FILE=.second-brain-ignore
CHAT_PROVIDER=hermes
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_AUTO_START=true
HERMES_REGULAR_MODEL=deepseek-v4-flash
HERMES_THINKING_MODEL=deepseek-v4-pro
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

Set `APP_SECRET` when binding to `0.0.0.0`. When present, local/private hosts can use the app passcode before they append, edit, triage, toggle, or rebuild.

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

For dual auth, keep GitHub on the public hostname and app passcode on local/private hosts:

```env
HOST=0.0.0.0
PORT=3030
APP_SECRET=your_local_lan_passcode
GITHUB_AUTH_HOSTS=secondbrain.vamshisasi.com
APP_SECRET_AUTH_HOSTS=127.0.0.1,localhost,192.168.68.5
```

With both GitHub OAuth and `APP_SECRET` configured:

- `https://secondbrain.vamshisasi.com` uses GitHub login.
- `http://192.168.68.5:3030` uses the app passcode.
- Hermes should stay bound to `127.0.0.1:8642`; the webapp remains the LAN-facing surface.

Set `CHAT_PROVIDER=hermes` to use the local Hermes gateway for Chat. Hermes is called through its OpenAI-compatible HTTP API at `HERMES_BASE_URL`, while the webapp still handles auth, sessions, capture, tasks, Sprint, Dashboard, and MCP.

Chat sessions are saved as Markdown under `CHAT_SESSIONS_DIR`, which defaults to `3.Resources/gpt/sessions`. The browser remembers the active session path and reloads it after refresh.

`HERMES_REGULAR_MODEL` defaults to `deepseek-v4-flash`, which is the right default for fast daily PKM chat. `HERMES_THINKING_MODEL` defaults to `deepseek-v4-pro` for harder synthesis, project planning, coding architecture, or quality-sensitive Deep Work sessions. The Chat tab has a Thinking toggle; off uses the regular model and on switches to the thinking model.

`DEEPSEEK_TRAINING_OPT_OUT=true` sends a best-effort `opt_out: training` request header. This is included as a privacy preference header, but confirm current DeepSeek policy/docs for any contractual training guarantees.

## Ignore Rules

Task indexing can ignore vault files or folders without changing the vault. Ignored paths are still indexed as notes for chat, file lookup, and vault context.

Use either:

- `INDEX_IGNORE=4.Archive/,2.Areas/Career/private-notes/`
- or copy `.second-brain-ignore.example` to `.second-brain-ignore` and add one vault-relative path per line.

Simple `*` wildcards are supported. Ignored paths are excluded from task lists and task/dashboard counts only; chat and file search can still use the full vault.

## iCloud Vault Notes

iCloud vault paths are supported, but iCloud can temporarily make Markdown files unreadable while it hydrates or reconciles them. In that case macOS may surface `Unknown system error -11`.

The app treats this as an iCloud availability issue:

- it keeps the last good SQLite index instead of replacing it with a partial or empty index
- for iCloud live vaults, set `VAULT_WATCH_ENABLED=false` and `AUTO_INDEX_ON_START=false`
- the app can use `NIGHTLY_INDEX_ENABLED=true` to rebuild once overnight instead of scanning during the day
- webapp writes reindex only the touched Markdown file, so capture/todo edits update without a full vault scan
- index reads use `ICLOUD_READ_RETRY_COUNT` before treating a file as temporarily unavailable
- manual `Rebuild index` is safe; if iCloud is mid-sync, the previous good index remains active

Hermes still runs from the vault path and can read the live Markdown vault directly. When `HYDRATE_VAULT_ON_START=true`, the launchd runner asks iCloud to download Hermes skill paths, including `.agents/skills`, and then pre-reads them before starting Hermes in the background. This helps iCloud materialize placeholder files so Hermes skill loading does not trip over transient `-11` reads, without blocking the webapp itself from starting.

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
