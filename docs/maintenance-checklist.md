# Maintenance Checklist

Use this when the app feels stale, after changing `.env`, or before larger updates.

For the fuller operating guide, see [operations-runbook.md](operations-runbook.md).

## Quick Health Check

From the app repo:

```bash
npm run doctor
```

1. Open Dashboard -> Settings.
2. Confirm:
   - Runtime is running and uptime looks recent.
   - Index watcher is `watching`.
   - Chat runtime is online.
   - OpenCode service is running if `OPENCODE_AUTO_START=true`.
   - Vault and target file point to the expected Obsidian vault.
   - App Git and Vault Git are in a state you expect.

## After Code Changes

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run check
launchctl kickstart -k gui/$(id -u)/com.vamshi.second-brain-app
```

Then hard refresh the browser or reopen the PWA if the UI looks stale.

## After `.env` Changes

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
launchctl kickstart -k gui/$(id -u)/com.vamshi.second-brain-app
npm run service:logs
```

## If Capture Or Tasks Look Stale

1. Open Dashboard.
2. Click `Rebuild index`.
3. Check Settings -> Index last run.

## If Chat Fails

1. Confirm OpenCode is running.
2. Check Dashboard -> Settings -> Chat runtime.
3. Confirm `OPENCODE_BASE_URL` matches `OPENCODE_HOST` and `OPENCODE_PORT`.
4. Run:

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run service:status
npm run service:logs
```

OpenCode should be running from `VAULT_PATH`, not the app repo, so it can load `.opencode/agents` and `.agents/skills`.

## Backup Hygiene

- `.env` stays local and ignored.
- `.data/` stays local and ignored.
- App repo and vault repo are separate.
- Commit app changes separately from vault note changes.
- Check dirty-state reminders in Dashboard -> Settings before major edits.

## Weekly Checks

- Run `npm run doctor`.
- Confirm capture writes still land in the current monthly fleeting note.
- Confirm index watcher is healthy.
- Confirm OpenCode is listening on `4096`.
- Confirm GitHub auth still works.
- Confirm public domain uses GitHub login and LAN IP uses app passcode if both auth methods are configured.
- Review service logs for repeated startup errors.
- Check app repo and vault repo dirty state.

## Monthly Checks

- Commit completed app changes in the app repo.
- Commit/backup vault note changes in the vault repo.
- Confirm `.env` is still private and recoverable from private backup.
- Confirm `.data/` and logs are not committed.
- Confirm Sprint/OKR tab resolves the current quarter/sprint.
- Confirm OpenCode starts from the vault and can see `.opencode/agents` and `.agents/skills`.
