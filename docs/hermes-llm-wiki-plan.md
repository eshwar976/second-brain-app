# Hermes + LLM Wiki Plan

This plan captures the next major architecture direction: evaluate Hermes as the chat/workflow runtime, then add an LLM-maintained wiki as a compiled knowledge layer on top of the existing Obsidian vault.

The current app remains useful as-is: capture, tasks, sprint, dashboard, Deep Work, MCP, and Mac mini service should keep working while this is explored.

## Target Architecture

```text
Webapp capture / tasks / sprint / dashboard
        |
        v
Markdown vault source-of-truth
        |
        +--> Raw source intake: Web Clipper, PDFs, articles, Readwise, pasted notes
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

### LLM Wiki

- Compiled knowledge layer.
- LLM-maintained Markdown pages.
- Durable synthesis from raw sources, fleeting notes, conversations, and reviews.
- Not the source-of-truth for tasks, OKRs, sprint plans, or raw capture.

### Obsidian Web Clipper And Other Intake Tools

- External-source inbox.
- Captures web articles into raw source folders.
- Does not write directly into the synthesized wiki.
- Hermes ingests clipped sources into the LLM Wiki after review.

## Recommended Vault Structure

```text
3.Resources/
  Sources/
    web/
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

`3.Resources/Sources` is raw source intake.

`3.Resources/llm-wiki` is derived synthesis.

## Source Frontmatter

Recommended source note shape:

```yaml
---
type: source
source-kind: web
status: inbox
clipped: 2026-05-23
url: https://example.com/article
title: Example Article
---
```

After ingest:

```yaml
---
type: source
source-kind: web
status: processed
clipped: 2026-05-23
processed: 2026-05-23
url: https://example.com/article
title: Example Article
---
```

## LLM Wiki Rules

- Hermes may write inside `3.Resources/llm-wiki` during approved wiki workflows.
- Hermes should not rewrite raw sources.
- Hermes should not rewrite fleeting notes.
- Hermes should not update OKRs, sprint files, or task files unless a separate explicit workflow asks for that.
- Every wiki page should include provenance links to raw sources or source notes.
- `index.md` is the wiki entrypoint.
- `log.md` is append-only.
- Contradictions should be reported before being resolved.
- Multi-file edits should produce a review summary before final write, at least until the workflow feels trustworthy.

## Phase H1: Hermes Spike

Goal: prove Hermes can replace or complement OpenCode without disrupting the current app.

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
- Keep OpenCode fallback.

Success criteria:

- One normal chat message works through Hermes from the webapp.
- No OpenCode-specific UI assumptions leak into the Hermes path.
- Existing capture/tasks/sprint/dashboard behavior is unchanged.

## Phase H2: Hermes Chat Replacement

Goal: replace OpenCode for normal chat only after the spike feels good.

Tasks:

- Rebuild chat sessions around Hermes or vault-native session files.
- Preserve current UI:
  - sessions drawer
  - thinking toggle, if Hermes supports mode/model switching
  - `/skill`, `@person`, and `#file`
  - selected context chips
  - typing indicator
  - Markdown rendering
- Remove OpenCode-specific labels from user-facing UI.
- Keep OpenCode as fallback until Hermes has survived real daily use.

Success criteria:

- Daily chat feels faster and more reliable.
- The webapp can start without requiring OpenCode for chat.
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

Safety:

- Keep writes scoped to known folders/formats.
- Prefer review before multi-file updates.
- Log workflow outputs.
- Reuse existing webapp capability boundaries where possible.

Success criteria:

- Hermes becomes useful for automation even before OpenCode is removed.
- Categorization and source ingest are faster or clearer than the OpenCode path.

## Phase W1: LLM Wiki Scaffold

Goal: create the compiled knowledge layer safely.

Create:

```text
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
- ingest workflow
- lint workflow
- contradiction handling

Success criteria:

- The wiki can be read and maintained by an agent without guessing structure.
- The boundary between raw sources and derived wiki is explicit.

## Phase W2: First Wiki Domain

Goal: prove value with one bounded domain.

Recommended first domain:

- Health habits: gym, ointment, psoriasis, self-care.

Alternative first domains:

- Personal System: cadence, OKRs, identity, sprint planning.
- Second Brain system itself.

Workflow:

- Hermes reads relevant raw notes and source notes.
- Hermes proposes:
  - new pages
  - updates to existing pages
  - contradictions
  - provenance links
- User approves.
- Hermes updates wiki pages, `index.md`, and `log.md`.

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
- Wiki update from new `status: inbox` source notes.
- Wiki lint:
  - stale pages
  - contradictions
  - missing backlinks
  - orphan pages
  - pages without provenance
- Wiki review queue:
  - proposed new pages
  - proposed edits
  - conflicts needing user decision

Success criteria:

- The wiki compounds without becoming noisy.
- Maintenance is mostly agent-driven but still reviewable.

## Phase H4: Remove OpenCode

Only do this after Hermes is proven.

Tasks:

- Remove OpenCode service startup from launchd helper.
- Remove OpenCode env requirements.
- Remove OpenCode-specific session/model code.
- Update README, runbook, maintenance checklist, and doctor.
- Keep a git checkpoint before removal.

Success criteria:

- The app runs with Hermes only.
- Chat, workflows, and status checks all work.
- There is no OpenCode-specific UI copy or config requirement.

## Recommended Order

1. Hermes spike.
2. Hermes provider behind feature flag.
3. LLM Wiki scaffold.
4. First bounded wiki domain.
5. Hermes workflow actions.
6. Wiki-aware chat.
7. Wiki maintenance.
8. Remove OpenCode.

## Open Questions

- Does Hermes expose a stable local HTTP API, or does the webapp need a CLI wrapper?
- How should Hermes sessions be stored: Hermes-native, vault Markdown, or app-managed?
- Should Hermes use the current `.agents/skills` contract directly?
- Should `3.Resources/Sources` be indexed by the webapp, Hermes, or both?
- Which wiki writes should require approval after the first safe domain is proven?
- Should MCP expose wiki ingest/status tools later?

