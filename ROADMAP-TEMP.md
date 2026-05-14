# Temporary Roadmap

This file tracks the current phase status for the Second Brain webapp. It is temporary and can later become a permanent `ROADMAP.md` or README section.

Last updated: 2026-05-14

## Current Priority Order

1. Phase 5: AI Workflows
2. Phase 6: Packaging / Maintenance
3. Optional polish from earlier phases
4. Rename / branding pass, including possible rename to Flowise

## Phase 1: Stabilization

Status: Done.

Done:
- Verified sprint dynamic selection, Last/Current/Next selector, Obsidian note links, and service worker cache bumps.
- Fixed OpenCode internal monologue leaks by waiting for completed OpenCode assistant responses.
- Kept the chat typing indicator as the only pending generation state.
- Ran baseline checks repeatedly:
  - `node --check server.js`
  - `node --check public/app.js`
  - `npm test`
  - `/api/health`
- Restarted the local app after major changes.

Left:
- No known Phase 1 blockers.
- Optional: commit a clean stabilization baseline once the current dirty working set is reviewed.

## Phase 2: Daily Workflow Reliability

Status: Done for MVP workflow.

Done:
- Capture writes to monthly fleeting files.
- Duplicate-submit protection for captures.
- Save/error feedback and toast states.
- Preserve typed capture text when save fails.
- Todo capture metadata for important/urgent/due.
- Task edit, triage, completion, and delayed removal.
- Ignore-list support for task/index exclusions.
- Capture timeline filters: Today, This week, Month.
- Capture type changes and swipe-to-chat behavior.
- Mobile layout fixes for horizontal and safe-area issues.

Left:
- Optional: deeper offline/PWA behavior and queued writes.
- Optional: broader manual mobile regression pass after every large UI change.

## Phase 3: Chat / OpenCode Integration

Status: Done for current design.

Done:
- Switched chat runtime to OpenCode.
- Uses OpenCode sessions endpoint for chat sessions.
- Uses OpenCode models endpoint/model config with regular and thinking modes.
- Thinking toggle maps to the configured thinking model.
- Uses `.opencode/agents/secondbrain.md` as the primary agent prompt.
- Removed app-injected generic PKM prompt.
- Supports `/skill`, `@person`, and `#file` context selection.
- Sends full selected skill/person/file context from the vault where relevant.
- Session sidebar with search/rename/delete behavior aligned to OpenCode where available.
- New chat behavior favors a fresh session unless a recent session is still active.
- OpenCode health/status surfaced in settings/dashboard area.

Left:
- Optional: richer session grouping/search later.
- Optional: additional mobile chat polish after Phase 5 workflows add more actions.

## Phase 4: Deep Work

Status: Done for daily use.

Done:
- Deep Work mode with active/inactive visual state.
- Persists Deep Work sessions to Markdown under `3.Resources/gpt/sessions/deep-work`.
- Deep Work files are separate from old chat session files.
- Tracks goal, status, conversation, decisions, tasks, and recap sections.
- Chat exchanges append into the active Deep Work Markdown file.
- End Deep Work flow writes a recap.
- Optional recap reflection capture into fleeting notes.
- Deep Work context is included in chat prompts and suggestion bias.

Left:
- Optional: link specific notes/projects to a Deep Work session from the UI.
- Optional: Deep Work dashboard/history view.

## Phase 4A: Sprint/OKR Expansion

Status: Done for current personal OKR model.

Done:
- Replaced Mentors tab with Sprint tab.
- Reads personal OKR and sprint data from Markdown.
- Dynamic sprint discovery by date.
- Supports Last / Current / Next sprint views when files exist.
- Updated for new sprint layout:
  - sprint index at `2.Areas/Personal/OKRs/FY2027/Q1/sprint-state-Q1-FY2027.md`
  - actual sprint plans under `2.Areas/Personal/OKRs/FY2027/Q1/sprints/sprint-YYYY-MM-DD.md`
- Current sprint resolves to the per-sprint file, not the index.
- Activity counts read `[activity:: ...]` logs from fleeting notes.
- Weekly sprint checkboxes can be updated from the app.
- Last sprint review signals:
  - unchecked weeks
  - missed activity targets
  - incomplete active KR
- Next sprint preview signals:
  - start timing
  - planned week count
- Open Sprint / Open OKRs links open the right Obsidian notes.
- Sprint/KR “open in chat” attaches relevant sprint/OKR context.

Left:
- Optional: create/edit next sprint from the app.
- Optional: career OKR/sprint support.
- Optional: quarter/year selector once multiple personal quarters accumulate.

## Phase 4B: Retrieval / Context Orchestration

Status: Done for current no-auto-RAG design.

Done:
- Kept SQLite as operational index, not the chat brain.
- Improved `/`, `@`, and `#` picker ranking.
- Added explicit selected context instead of auto-injecting indexed notes.
- Added suggested context chips while typing.
- Suggested context does not attach automatically; user must tap to attach.
- Improved suggested context scoring:
  - rewards multi-term matches
  - prefers OKR/sprint files for OKR prompts
  - filters skill markdown out of file-style suggestions
- Added recent context chips.
- Added pinned/favorite context chips.
- Added suggested context hide/dismiss controls.
- Added Deep Work suggestion bias toward active Deep Work log and current sprint.
- Context drawer now groups:
  - Selected
  - Pinned
  - Recent
  - Suggested
- Context drawer actions:
  - Add
  - Open
  - Pin
  - Unpin
  - Remove
  - Dismiss
- Refined `.opencode/agents/secondbrain.md` retrieval rules.
- Confirmed no OpenCode monologue leak remains.

Left:
- Optional: favorite management UI beyond pin/unpin inside drawer.
- Optional: source preview snippets inside the context drawer.
- Optional: more ranking tuning as real usage reveals patterns.

## Phase 5: AI Workflows

Status: In progress.

Done:
- Session-level Actions menu in Chat keeps AI workflow commands out of individual message cards.
- Summarize chat into a fleeting note with a session link/source.
- Extract todos from chat into the same monthly fleeting note format used by capture todos.
- Generate structured draft notes from chat under `3.Resources/gpt/notes`.
- Monthly fleeting review workflow from Dashboard.
- Monthly reviews are written as separate drafts under `3.Resources/gpt/reviews/fleeting` without changing the raw fleeting log.

Left:
- Changelog update workflow via skills.
- About-me update workflow via skills.

Recommended order:
1. Chat to fleeting summary with session link.
2. Chat to todo extraction.
3. Chat to structured note generation.
4. Monthly fleeting review.
5. Changelog/about-me maintenance workflows.

## Phase 6: Packaging / Maintenance

Status: Not started.

Planned:
- Mac mini launch setup.
- Durable local startup instructions.
- Backup hygiene and dirty-state visibility.
- App repo and vault repo separation docs.
- Maintenance checklist.
- Rename / branding decision.

Flowise rename:
- Recommended timing: Phase 6, after AI workflows are stable.
- Reason: renaming now touches app labels, manifest, docs, repo naming, and maybe service worker/cache names. It is safer after core workflow behavior settles.

## Current Assumptions

- OpenCode remains the chat runtime.
- Markdown remains the source of truth.
- SQLite remains a cache/index for operations, not the chat brain.
- Personal sprint/OKR remains the Sprint tab v1 scope.
- Career OKRs remain out of scope until explicitly planned.
- No rename to Flowise until Phase 6 unless the user explicitly prioritizes it earlier.
