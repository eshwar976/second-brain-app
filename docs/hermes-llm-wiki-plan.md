# Hermes + LLM Wiki Plan

This plan captures the next major architecture direction: Hermes as the chat/workflow runtime, plus an LLM-maintained wiki as a compiled knowledge layer on top of the existing Obsidian vault. Obsidian Web Clipper is the preferred raw web-source intake path.

The current app remains useful as-is: capture, tasks, sprint, dashboard, Deep Work, MCP, and Mac mini service should keep working while this is explored.

## Target Architecture

```text
Webapp capture / tasks / sprint / dashboard
        |
        v
Markdown vault source-of-truth
        |
        +--> Raw source intake: Obsidian Web Clipper, PDFs, articles, Readwise, pasted notes
        |
        +--> Hermes agent runtime
                 |
                 +--> chat
                 +--> workflow actions
                 +--> source ingest
                 +--> LLM Wiki maintenance
        |
        v
3.Resources/llm-wiki
```

Core principle: raw notes and operational Markdown remain source-of-truth. The LLM Wiki is a derived, curated, reviewable layer.

## Roles

### Webapp

- Quick capture.
- Todo/task operations.
- Sprint/OKR and habit visibility.
- Dashboard and operational status.
- Safe Markdown writes with known formats.
- MCP capability surface for trusted clients.

### Hermes

- Chat runtime candidate.
- Workflow automation runtime.
- Fleeting note categorization.
- Source ingest and synthesis.
- LLM Wiki maintenance.
- Future assistant/smart-speaker workflow brain, if it proves reliable.

Hermes should act as a vault maintainer through explicit vault skills, not as an unrestricted editor. The current maintenance skill stack is:

- `personal-manager` — personal OKRs, sprint state, daily focus, habits, personal task friction, and automation-safe personal maintenance.
- `about-me-curator` — about-me/changelog curation and automation-safe candidate preparation.
- `personal-idea-evaluator` — personal idea scoring and idea-ledger routing.
- `llm-wiki-curator` — Web Clipper source inbox to derived LLM Wiki.
- `vault-maintenance-runner` — read-first audit/router for maintenance status and next actions.

Automation runs should write audit entries to `3.Resources/gpt/automation-log.md` when they change files.

### LLM Wiki

- Compiled knowledge layer.
- LLM-maintained Markdown pages.
- Durable synthesis from raw sources, fleeting notes, conversations, and reviews.
- Not the source-of-truth for tasks, OKRs, sprint plans, or raw capture.

### Obsidian Web Clipper And Other Intake Tools

- External-source inbox.
- Captures web articles into raw source folders using a consistent source-note template.
- Does not write directly into the synthesized wiki.
- Hermes ingests clipped sources into the LLM Wiki after review.
- Clipped notes are treated as evidence, not conclusions.

## Recommended Vault Structure

```text
3.Resources/
  Sources/
    web/
      inbox/
      processed/
      skipped/
    pdfs/
    books/
    transcripts/
  llm-wiki/
    AGENTS.md
    index.md
    log.md
    sources.md
    pages/
      concepts/
      people/
      projects/
      systems/
      health/
      career/
```

`3.Resources/Sources` is raw source intake. Web Clipper should write web links to `3.Resources/Sources/web/inbox` first.

`3.Resources/llm-wiki` is derived synthesis.

## Web Clipper Source Template

Use a Web Clipper template that creates source notes with predictable frontmatter and a stable body shape. Exact Web Clipper variables can be adapted to the plugin, but the resulting Markdown should look like this:

Recommended source note shape:

```yaml
---
type: source
source_kind: web
status: inbox
clipped_at: 2026-05-23
url: https://example.com/article
title: Example Article
author:
published:
site:
topics: []
wiki_status: pending
wiki_pages: []
---
```

Recommended body:

```md
# Example Article

Source URL: https://example.com/article

## Summary From Source

Optional short clipper/browser summary if available.

## Highlights

- Optional highlights or quotes.

## Full Text

Clipped article body.

## Notes

Personal notes added later.
```

After ingest:

```yaml
---
type: source
source_kind: web
status: processed
clipped_at: 2026-05-23
processed_at: 2026-05-23
url: https://example.com/article
title: Example Article
author:
published:
site:
topics:
  - example-topic
wiki_status: processed
wiki_pages:
  - 3.Resources/llm-wiki/pages/example-topic.md
---
```

Skipped source:

```yaml
---
type: source
source_kind: web
status: skipped
wiki_status: skipped
skip_reason: not relevant
---
```

## Source Intake Rules

- Web Clipper writes only to `3.Resources/Sources/web/inbox` by default.
- Do not clip directly into `3.Resources/llm-wiki`.
- Keep source notes close to the original content; avoid rewriting them into conclusions.
- Hermes may add processing metadata such as `processed_at`, `wiki_status`, `topics`, and `wiki_pages` during approved ingest workflows.
- Hermes should not rewrite the article body except for explicit cleanup that preserves meaning.
- If the same `url` already exists in `Sources/web`, Hermes should mark the newer note as duplicate or link both before ingesting.
- `status: inbox` means “available for Hermes ingest.”
- `status: processed` means “already reflected in the wiki.”
- `status: skipped` means “reviewed and intentionally not ingested.”

## LLM Wiki Rules

- Hermes may write inside `3.Resources/llm-wiki` during approved wiki workflows.
- Hermes should not rewrite raw sources.
- Hermes should not rewrite fleeting notes.
- Hermes should not update OKRs, sprint files, or task files unless a separate explicit workflow asks for that.
- Every wiki page should include provenance links to raw sources or source notes.
- Prefer links to source notes over bare external URLs. The source note itself should contain the external URL.
- `index.md` is the wiki entrypoint.
- `log.md` is append-only.
- Contradictions should be reported before being resolved.
- Multi-file edits should produce a review summary before final write, at least until the workflow feels trustworthy.

## Phase H1: Hermes Spike

Goal: prove Hermes can run chat without disrupting the rest of the app.

Tasks:

- Install/run Hermes locally from the vault root.
- Confirm Hermes can see:
  - `.agents/skills`
  - vault Markdown
  - future `3.Resources/llm-wiki`
- Identify runtime interface:
  - local HTTP API preferred
  - CLI wrapper acceptable for spike
- Add experimental `CHAT_PROVIDER=hermes`.
- Implement:
  - health check
  - send message
  - basic runtime/model/config status
- Keep the rest of the webapp behavior unchanged.

Status:

- Implemented `CHAT_PROVIDER=hermes` against Hermes' OpenAI-compatible HTTP API.
- Hermes health/model/runtime status is surfaced through the existing webapp config.
- Launchd can start `hermes gateway run` from `VAULT_PATH`.
- Hermes is now the app's primary local chat runtime.

Success criteria:

- One normal chat message works through Hermes from the webapp.
- No legacy provider-specific UI assumptions leak into the Hermes path.
- Existing capture/tasks/sprint/dashboard behavior is unchanged.

## Phase H2: Hermes Chat Replacement

Goal: make Hermes the normal chat runtime.

Tasks:

- Rebuild chat sessions around Hermes or vault-native session files.
- Preserve current UI:
  - sessions drawer
  - thinking toggle, if Hermes supports mode/model switching
  - `/skill`, `@person`, and `#file`
  - selected context chips
  - typing indicator
  - Markdown rendering
- Remove legacy provider-specific labels from user-facing UI.
- Keep chat sessions vault-native and recoverable.

Status:

- In progress. Normal chat now uses Hermes.
- The webapp still owns Markdown session files under `CHAT_SESSIONS_DIR`, which keeps chat history vault-native during the transition.

Success criteria:

- Daily chat feels faster and more reliable.
- The webapp can start without requiring a separate chat shell.
- Sessions remain recoverable after restart.

## Phase H3: Hermes Workflow Actions

Goal: make Hermes the agent that performs vault workflows.

Candidate workflows:

- Categorize fleeting notes with `[domain::]` and `[activity::]`.
- Save chat summary to fleeting note.
- Extract todos from chat into the current monthly fleeting note.
- Generate structured note drafts.
- Run Sprint tab Categorize action.
- Ingest raw sources into the LLM Wiki.

Implemented skill contracts:

- `personal-manager` has Mode 8 for automation-safe personal maintenance.
- `about-me-curator` has Mode 4 for automation-safe curation.
- `llm-wiki-curator` owns source inbox and LLM Wiki maintenance.
- `vault-maintenance-runner` audits and routes maintenance work without broad content edits.

Safety:

- Keep writes scoped to known folders/formats.
- Prefer review before multi-file updates.
- Log workflow outputs.
- Reuse existing webapp capability boundaries where possible.

Success criteria:

- Hermes becomes useful for automation beyond regular chat.
- Categorization and source ingest are fast and clear from the Hermes path.

## Phase W1: LLM Wiki Scaffold

Goal: create the compiled knowledge layer safely.

Status: Implemented.

Create:

```text
3.Resources/Sources/
  web/
    inbox/
    processed/
    skipped/
3.Resources/llm-wiki/
  AGENTS.md
  index.md
  log.md
  sources.md
  pages/
```

Seed `AGENTS.md` with:

- allowed write paths
- page conventions
- provenance rules
- Web Clipper source ingest workflow
- lint workflow
- contradiction handling

Seed `sources.md` with:

- inbox source query/listing convention
- processed source listing convention
- skipped/duplicate source convention
- rule that source notes are evidence, not final synthesis

Success criteria:

- The wiki can be read and maintained by an agent without guessing structure.
- The boundary between raw sources and derived wiki is explicit.
- Web Clipper output lands in a predictable inbox for Hermes.

Implemented:

- Created `3.Resources/Sources/web/inbox`, `processed`, and `skipped`.
- Created `3.Resources/llm-wiki` with `AGENTS.md`, `index.md`, `sources.md`, `log.md`, and page folders.
- Added folder guide notes so the structure is visible and self-documenting in Obsidian.

## Phase W2: First Wiki Domain

Goal: prove value with one bounded domain.

Recommended first domain:

- Health habits: gym, ointment, psoriasis, self-care.

Alternative first domains:

- Personal System: cadence, OKRs, identity, sprint planning.
- Second Brain system itself.

Workflow:

- Web Clipper saves relevant links into `3.Resources/Sources/web/inbox`.
- Hermes reads relevant raw notes and `status: inbox` source notes.
- Hermes proposes:
  - new pages
  - updates to existing pages
  - contradictions
  - provenance links
  - source status changes
- User approves.
- Hermes updates wiki pages, `index.md`, `sources.md`, and `log.md`.
- Hermes marks ingested source notes as `status: processed`, sets `processed_at`, and adds `wiki_pages`.

Success criteria:

- 5-10 useful pages exist.
- Chat answers improve because Hermes can consult compiled pages first.
- The wiki feels like a maintained artifact, not another inbox.

## Phase W3: Wiki-Aware Chat

Goal: make chat faster and more synthesized.

Preferred retrieval order:

1. `3.Resources/llm-wiki/index.md`
2. relevant wiki pages
3. explicitly selected context
4. raw sources only when needed
5. fleeting notes for recent evidence

Success criteria:

- Questions about recurring patterns hit the wiki first.
- Hermes reads fewer raw notes for common questions.
- Answers cite wiki pages and source notes where useful.

## Phase W4: Wiki Maintenance

Goal: prevent the wiki from becoming stale.

Workflows:

- Wiki update from recent fleeting notes.
- Wiki update from new Web Clipper notes with `type: source`, `source_kind: web`, and `status: inbox`.
- Duplicate URL detection for clipped sources.
- Source triage:
  - process into wiki
  - skip with reason
  - hold for later
- Wiki lint:
  - stale pages
  - contradictions
  - missing backlinks
  - orphan pages
  - pages without provenance
  - processed sources not listed in `sources.md`
  - wiki pages with external URLs but no source-note link
- Wiki review queue:
  - proposed new pages
  - proposed edits
  - conflicts needing user decision

Success criteria:

- The wiki compounds without becoming noisy.
- Maintenance is mostly agent-driven but still reviewable.

## Phase H4: Provider Cleanup

Only do this after Hermes is proven.

Tasks:

- Remove old provider service startup from launchd helper.
- Remove old provider env requirements.
- Remove old provider-specific session/model code.
- Update README, runbook, maintenance checklist, and doctor.
- Keep a git checkpoint before removal.

Success criteria:

- The app runs with Hermes only.
- Chat, workflows, and status checks all work.
- There is no legacy provider-specific UI copy or config requirement.

## Recommended Order

1. Hermes spike.
2. Hermes provider behind feature flag.
3. LLM Wiki scaffold.
4. First bounded wiki domain.
5. Hermes workflow actions.
6. Wiki-aware chat.
7. Wiki maintenance.
8. Provider cleanup.

## Open Questions

- Does Hermes expose a stable local HTTP API, or does the webapp need a CLI wrapper?
- How should Hermes sessions be stored: Hermes-native, vault Markdown, or app-managed?
- Should Hermes use the current `.agents/skills` contract directly?
- Should `3.Resources/Sources` be indexed by the webapp, Hermes, or both?
- Which wiki writes should require approval after the first safe domain is proven?
- Should MCP expose wiki ingest/status tools later?
