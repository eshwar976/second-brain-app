# Mac Mini Service

Run the Second Brain app as a native macOS `launchd` service. This keeps the app local to the Mac mini while making startup and restart boring.

The installer starts Hermes with the webapp when `HERMES_AUTO_START=true`. Hermes runs from the configured `VAULT_PATH`, so vault-native files like `.agents/skills` and Markdown notes are visible without extra mounting or copying.

## Install

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
```

The installer creates:

- `~/Library/LaunchAgents/com.vamshi.second-brain-app.plist`
- `~/Library/Application Support/SecondBrain/run-webapp.sh`
- `.data/logs/launchd.out.log`
- `.data/logs/launchd.err.log`

It does not copy app code into the vault and it does not modify `.env`.

## Chat Agent Settings

The service installer reads these from `.env`:

```env
CHAT_PROVIDER=hermes
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_AUTO_START=true
HERMES_HOST=127.0.0.1
HERMES_PORT=8642
HERMES_BIN=
HERMES_REGULAR_MODEL=deepseek-v4-flash
HERMES_THINKING_MODEL=deepseek-v4-pro
```

Keep `HERMES_BASE_URL` aligned with the Hermes API server port. Hermes itself should stay bound to `127.0.0.1`; the webapp remains the LAN-facing surface.

Set `HERMES_AUTO_START=false` if you want to manage Hermes yourself.

## Check Status

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:status
```

## View Logs

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:logs
```

## Restart

```bash
launchctl kickstart -k gui/$(id -u)/com.vamshi.second-brain-app
```

## Uninstall

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:uninstall
```

## Notes

- The web app service runs a generated helper at `~/Library/Application Support/SecondBrain/run-webapp.sh`.
- That helper starts Hermes in the background from `VAULT_PATH`, then starts this repo's `server.js` in the foreground.
- Hermes output is captured in the same `launchd.out.log` / `launchd.err.log` files as the web app.
- The helper sources `~/.zprofile` first so Homebrew, Node, and Hermes paths can be available to `launchd`.
- The LaunchAgent uses `~/Library/Application Support/SecondBrain` as its launch working directory to avoid macOS background-process weirdness with `Documents`; the helper then changes into the app repo or vault before starting each process.
- If Node is not on `PATH`, it falls back to `/opt/homebrew/bin/node` and `/usr/local/bin/node`.
- Keep `HOST`, `PORT`, GitHub OAuth, Hermes, and vault settings in `.env`.
