# Operations Runbook

This is the daily operator guide for the Mac mini setup.

## Paths

- App repo: `/Users/vamshi/Documents/obsidian/second-brain-app`
- Vault: `/Users/vamshi/Documents/obsidian/obsidian-personal`
- LaunchAgent: `~/Library/LaunchAgents/com.vamshi.second-brain-app.plist`
- Service helper: `~/Library/Application Support/SecondBrain/run-webapp.sh`
- Logs: `/Users/vamshi/Documents/obsidian/second-brain-app/.data/logs/`

## How To Run On The Mac Mini

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
npm run doctor
```

Open:

```text
https://secondbrain.vamshisasi.com/
```

For local-only access:

```text
http://127.0.0.1:3030/
```

## How To Update

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
git status --short
npm run doctor
npm run check
npm run service:install
npm run doctor
```

Then hard-refresh the browser or reopen the PWA if the UI looks stale.

## How To Restart After Reboot

The service should start automatically after login/reboot.

Check:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:status
npm run doctor
```

Manual restart:

```bash
launchctl kickstart -k gui/$(id -u)/com.vamshi.second-brain-app
```

If the service is missing:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
```

## How To Restore If Something Breaks

1. Restore or clone the app repo.
2. Restore `.env` from private backup.
3. Restore or clone the vault separately.
4. Run `npm install` if `node_modules/` is missing.
5. Confirm `.env` points at the restored vault path.
6. Run:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
npm run doctor
```

7. Open Dashboard -> Settings and confirm:
   - vault path
   - runtime status
   - index watcher
   - OpenCode status
   - app/vault git state

## Common Failure Modes

### App opens but Capture or Tasks look stale

1. Open Dashboard.
2. Click `Rebuild index`.
3. Check Dashboard -> Settings -> Index last run.

### Chat does not respond

1. Run `npm run doctor`.
2. Confirm OpenCode is listening on `4096`.
3. Confirm `OPENCODE_BASE_URL=http://127.0.0.1:4096`.
4. Check logs with `npm run service:logs`.

### Wrong auth method appears

Use host-aware auth:

```env
HOST=0.0.0.0
APP_SECRET=your_local_lan_passcode
GITHUB_AUTH_HOSTS=secondbrain.vamshisasi.com
APP_SECRET_AUTH_HOSTS=127.0.0.1,localhost,192.168.68.5
```

Expected behavior:

- `https://secondbrain.vamshisasi.com/` shows GitHub login.
- `http://192.168.68.5:3030/` shows app passcode.

After changing `.env`:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
npm run doctor
```

### Browser shows old UI

1. Hard-refresh the browser.
2. Reopen the PWA if installed.
3. Restart the service if backend changes were made.

### Service logs show path or permission errors

Run:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:install
npm run service:logs
```

The LaunchAgent should run from `~/Library/Application Support/SecondBrain`, then the helper changes into the app repo and vault as needed.

## Weekly Maintenance

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run doctor
git status --short
```

Check:

- Capture writes still land in the current monthly fleeting note.
- Dashboard -> Settings shows index watcher as healthy.
- OpenCode is listening on `4096`.
- GitHub auth still works in the browser.
- App repo dirty state is expected.
- Vault repo dirty state is expected.
- Logs do not show repeated startup errors.

## Monthly Maintenance

Check:

- App repo has meaningful commits for completed app changes.
- Vault repo has meaningful commits/backups for note changes.
- `.env` is still private and available in your private backup.
- `.data/` has not accidentally been committed.
- Current month fleeting file is being created/written correctly.
- Sprint/OKR tab resolves the current quarter/sprint.
- OpenCode still starts from the vault and can see `.opencode/agents` and `.agents/skills`.

## Before Bigger Refactors

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run doctor
npm run check
git status --short
```

Then check the vault:

```bash
cd /Users/vamshi/Documents/obsidian/obsidian-personal
git status --short
```
