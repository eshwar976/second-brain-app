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
INDEX_IGNORE=
INDEX_IGNORE_FILE=.second-brain-ignore
```

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
- `GET /api/tasks?status=open&scope=all|work|personal&focus=all|due|due-soon|high|do-now|schedule|quick|someday|triage`
- `POST /api/tasks/toggle`
- `POST /api/tasks/triage`

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

Captures are grouped by day inside the current monthly file:

```md
## 2026-05-05

- 15:32 [type:: log] initial capture app looks good. testing the actual change
- [ ] follow up on PKM capture UI [type:: todo] [important:: true] [urgent:: false] [priority:: medium] [due:: 2026-05-12] [created:: 2026-05-05 3:35 PM]
```
