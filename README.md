# Second Brain App

A small local-first capture web app for appending quick notes to an Obsidian vault.

## MVP

- Runs locally on the Mac mini.
- Uses a configurable `VAULT_PATH`.
- Shows recent captures like a chat timeline.
- Appends new captures to `2.Areas/Personal/fleeting/YYYY-MM.md`.
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
```

## API

- `GET /api/health`
- `GET /api/config/public`
- `GET /api/captures/recent`
- `POST /api/captures`

Example capture:

```bash
curl -X POST http://127.0.0.1:3030/api/captures \
  -H 'Content-Type: application/json' \
  -d '{"category":"thought","text":"capture before it gets polished"}'
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
- [ ] follow up on PKM capture UI [type:: todo] [created:: 2026-05-05 15:35]
```
