# Repo And Backup Hygiene

The app and vault are intentionally separate.

## Boundaries

- App repo: `/Users/vamshi/Documents/obsidian/second-brain-app`
- Vault: `/Users/vamshi/Documents/obsidian/obsidian-personal`

The app repo owns:

- app source code
- service scripts
- documentation
- `.env.example`
- local runtime cache under `.data/`

The vault owns:

- Markdown notes
- Obsidian config
- `.agents/skills`
- chat/deep-work/generated notes that are intentionally written as Markdown

## Never Commit

These stay local:

- `.env`
- `.data/`
- `node_modules/`
- generated logs
- secrets, tokens, OAuth client secrets

## Before Larger Updates

```bash
cd /Users/vamshi/Documents/obsidian/second-brain-app
npm run doctor
git status --short
```

Then check the vault separately:

```bash
cd /Users/vamshi/Documents/obsidian/obsidian-personal
git status --short
```

## Backup Rhythm

- Commit app behavior changes in the app repo.
- Commit note/content changes in the vault repo.
- Avoid mixing app code changes and vault note edits in the same mental checkpoint.
- Use Dashboard -> Settings or `npm run doctor` to catch dirty state before changing services.

## Restore Shape

To restore the app on the Mac mini:

1. Restore or clone the app repo.
2. Restore `.env` from your private backup.
3. Restore or clone the vault separately.
4. Run `npm install` if `node_modules` is missing.
5. Run `npm run service:install`.
6. Run `npm run doctor`.
