# MCP Client Setup

Second Brain exposes a narrow MCP-compatible HTTP endpoint for trusted LAN/internal clients when `MCP_ENABLED=true`.

Use this only on a trusted network. Do not expose this endpoint to the public internet without a deliberate reverse proxy, HTTPS, scoped tokens, and audit review.

## Endpoint

Local Mac mini:

```text
http://127.0.0.1:3031/mcp
```

LAN clients:

```text
http://<mac-mini-ip>:3031/mcp
```

For the current Mac mini IP, check your router, macOS network settings, or run:

```bash
ipconfig getifaddr en0
```

## Authentication

Preferred header:

```http
Authorization: Bearer <MCP_TOKEN>
```

`MCP_TOKEN` lives in `.env` and should be different from `APP_SECRET`.

Local loopback development may still accept:

```http
X-Second-Brain-Secret: <APP_SECRET>
```

For real LAN clients, use `MCP_TOKEN`.

## Safe Default Tools

The default `MCP_ALLOWED_TOOLS` is intentionally small:

```env
MCP_ALLOWED_TOOLS=capture.append,capture.recent,tasks.create,tasks.list,sprint.current,sprint.set_daily_focus,dashboard.summary
```

This is enough for:

- Quick capture.
- Create a todo.
- Read current tasks.
- Read current sprint/focus state.
- Set daily focus.
- Read dashboard summary.

Avoid enabling broad vault or chat tools until client scopes and audit review are proven.

## Client Names

Send a client name so audit entries are useful:

```http
X-MCP-Client: work-laptop
```

Other accepted names:

```http
X-Client-Name: work-laptop
```

or JSON-RPC `_meta.clientName`.

## Optional Client-Specific Scopes

Use `MCP_CLIENT_TOOL_ALLOWLISTS` to narrow tools for named clients.

Format:

```env
MCP_CLIENT_TOOL_ALLOWLISTS="smart-speaker:capture.append|tasks.create|sprint.current|dashboard.summary;work-laptop:capture.recent|tasks.list|sprint.current|dashboard.summary"
```

Behavior:

- Global `MCP_ALLOWED_TOOLS` is always the maximum allowed set.
- If a named client has a scope, it only sees and calls tools in that scope.
- If no scope is configured for a client, it uses the global tool allowlist.

Use this before connecting always-on clients such as smart speakers, Home Assistant, or background automations.

## Smoke Test

From the Mac mini:

```bash
set -a
source .env
set +a

curl -sS -X POST "http://127.0.0.1:${MCP_PORT}/mcp" \
  -H "Authorization: Bearer ${MCP_TOKEN}" \
  -H "X-MCP-Client: smoke-test" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

From another LAN computer, replace `127.0.0.1` with the Mac mini IP.

## Audit

Audit entries are written to:

```env
MCP_AUDIT_LOG=.data/mcp-audit.jsonl
```

They are also visible in webapp Settings.

Audit entries include:

- timestamp
- remote address
- client name
- tool
- read/write risk
- affected vault path where available
- success/failure

Audit entries should not contain secrets or full note bodies.

## Operational Checks

Run:

```bash
npm run doctor
```

Expected MCP checks when enabled:

- MCP token configured.
- MCP rate limit configured.
- MCP listener on the configured port.
- Client scopes configured if you are using always-on clients.
