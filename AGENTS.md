# Taskflow

The core GUI for Sean's daily-note → project task system: an Obsidian sidebar panel with four sections (Today / Overdue & slipped / Inbox triage / Project backlogs) over the vault's task pipeline.

Originally forked from `delashum/obsidian-checklist-plugin` — its card-list visual language (group headers, subtask hierarchy from `82579e9`) is kept; the tag-based data layer is replaced. History preserved; MIT credit retained. This is now a standalone plugin: repo `SeanYHan888/obsidian-taskflow`.

Read `CONTEXT.md` (glossary — use its vocabulary) and `docs/adr/` before working.

## Design rules (non-negotiable)

- **Stateless projection.** No task cache, no synthetic IDs in `data.json`. Read tasks from the Obsidian Tasks plugin API (`getTasks()`) + project frontmatter from the metadata cache; write by editing source lines (complete via the Tasks API so ✅ done-dates and Apple Reminders write-back keep working). See ADR-0001.
- **Taskflow is the reminder; Day Planner is the calendar.** The panel never reads or writes `# Events:` sections, and never projects the Apple Calendar section of the Apple Sync note. Apple *Reminders* are in scope. See ADR-0003.
- **Face, not organ.** The panel replaces only the vault's `Indexes/System/Work Queue.md` query note (which stays as fallback). Tasks, Bases, Day Planner, and templates own everything else.
- **Interop-clean.** Personal-first (workflow model hardcoded, paths in settings), but never assume Taskflow owns a note's layout — e.g. a project note may become an obsidian-kanban board, so the move-to-project target heading is a setting (default `## Tasks`).
- The workflow being served is documented in the vault: `Indexes/System/Project Workflow.md` (vault repo: `SeanYHan888/obsidian-vault`, branch `pipeline-panel`).

## Workflow model the panel must mirror

- Tasks are checkbox lines; emoji format (`⏳` scheduled = planned day, `📅` due = hard deadline, `✅`/`[-]`). Never write dataview-style `[scheduled:: ]` fields.
- Projects = notes in `Projects/Active/` with frontmatter `status: now|next|later`; location = membership (no project tags on task lines).
- Section rules (panel order: To-do → Inbox → Overdue & slipped → Projects — capture sits directly under commitment):
  - **To-do** (internal key `today`) = open tasks scheduled or due today. Excludes the Apple Sync note's Calendar section (calendar blocks are Day Planner's world; its Reminders section is included).
  - **Overdue & slipped** = due before today, OR scheduled before today outside the Apple Sync note. (Overdue Reminders nag; missed calendar blocks never surface — intended asymmetry.)
  - **Inbox** = undated open tasks under a daily note's `# Inbox` heading only, excluding blank descriptions. Checkboxes under other headings are not Taskflow's business.
  - **Backlogs** = open tasks in `Projects/Active/`, grouped by project, `now` first, with a `n/3` WIP badge counting projects in `now` (red at 4+, warn never block).
- Sections are disjoint projections of one field (the date); tasks never "move" between them except by date edits or the passage of days.

## Tech stack

TypeScript 5 (strict) + Svelte 5 (runes) + esbuild + Vitest. See ADR-0002. The brain is framework-free: `src/core/` is pure TS (section classification, date rules, line-move logic) with zero Svelte/Obsidian imports; `src/adapters/` wraps the Tasks API, metadata cache, and vault edits; `src/ui/` is thin Svelte.

## Roadmap (each version ships usable; tracked as GitHub issues)

- **v0.1** — four read-only sections + check-off + click-to-jump + settings.
- **v0.2** — `⏳` date chip menu (today/tomorrow/weekend/pick), one-tap reschedule row on slipped, bulk "all → today". No date edits on Apple Sync tasks (machine-rewritten note).
- **v0.3** — triage: select mode, bulk move-to-project (fuzzy picker + create-from-template `Templates/project.md`), physically cuts lines with subtask children into the project's target heading.
- **v0.4** — polish: WIP badge, counts, empty states, mobile pass.

## Dev loop

`npm install && npm run dev` (esbuild watch) → build lands in the vault's `.obsidian/plugins/taskflow/` → Hot Reload plugin or the obsidian-cli skill to reload, capture console errors, and screenshot the panel in the real vault. The vault is Sean's live personal vault: test builds fine (git-protected), never mass-edit notes — the plugin edits single task lines on explicit user action only. Day Planner's `data.json` contains private calendar URLs — never commit or copy it.

## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues on `SeanYHan888/obsidian-taskflow` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
