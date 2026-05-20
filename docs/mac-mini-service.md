# Mac Mini Service

Run the Second Brain app as a native macOS `launchd` service. This keeps the app local to the Mac mini while making startup and restart boring.

The installer also starts OpenCode HTTP when `OPENCODE_AUTO_START=true`, which is the default. OpenCode runs from the configured `VAULT_PATH`, so vault-native files like `.opencode/agents` and `.agents/skills` are visible to OpenCode without extra mounting or copying.

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

## OpenCode Settings

The service installer reads these from `.env`:

```env
OPENCODE_AUTO_START=true
OPENCODE_HOST=127.0.0.1
OPENCODE_PORT=4096
OPENCODE_BIN=
OPENCODE_BASE_URL=http://127.0.0.1:4096
```

Keep `OPENCODE_BASE_URL` aligned with `OPENCODE_HOST` and `OPENCODE_PORT`.

Set `OPENCODE_AUTO_START=false` if you want to manage OpenCode yourself.

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
- That helper starts OpenCode in the background from `VAULT_PATH`, then starts this repo's `server.js` in the foreground.
- OpenCode output is captured in the same `launchd.out.log` / `launchd.err.log` files as the web app.
- The helper sources `~/.zprofile` first so Homebrew, Node, and OpenCode paths can be available to `launchd`.
- The LaunchAgent uses `~/Library/Application Support/SecondBrain` as its launch working directory to avoid macOS background-process weirdness with `Documents`; the helper then changes into the app repo or vault before starting each process.
- If Node is not on `PATH`, it falls back to `/opt/homebrew/bin/node` and `/usr/local/bin/node`.
- Keep `HOST`, `PORT`, GitHub OAuth, OpenCode, and vault settings in `.env`.
