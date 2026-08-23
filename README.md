# Taskflow

An Obsidian sidebar panel that turns daily-note capture into project execution. Your markdown is the database; the panel is a projection of it — Taskflow keeps no task store of its own, mints no IDs, and edits a task line only when you act on it.

Four sections over your vault's tasks:

- **To-do** — open tasks scheduled (`⏳`) or due (`📅`) today, followed by your undated inbox captures. One working list: the day's commitments and the triage queue.
- **Overdue & slipped** — tasks due before today or scheduled before today. A repair queue: reschedule with one tap, sweep everything to today, or cancel.
- **Upcoming** — tasks dated later, visible while they wait, so scheduling ahead never makes a task disappear. Collapsed by default.
- **Projects** — the open tasks in each project note, grouped by project. Projects with a `deadline` lead soonest-first; the rest follow their `status` (`now` / `next` / `later`), with a work-in-progress badge that warns (never blocks) past your limit.

Everything the panel does is a plain text edit you could have made yourself, and every panel action has an undo — a session journal plus an undo link on each notice.

## Requirements

- **[Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin** (emoji format). Taskflow reads tasks through it and completes tasks through its API, so done-dates, recurrence, and any downstream sync keep working. Without it the panel explains itself instead of rendering.
- **Daily notes** (the core Daily Notes plugin) if you want capture: undated tasks under an `# Inbox` heading (configurable, plain text match — any language) in a daily note appear in the panel for triage. Taskflow follows the Daily Notes plugin's folder and date format automatically.

Projects are optional: without a projects folder, Taskflow is a pure daily-note task panel, and the Backlogs section explains how to grow into the project workflow.

## 60-second setup

1. Install and enable **Tasks**, then **Taskflow**.
2. Open the panel (ribbon icon, or the "Open panel" command).
3. Add `- [ ] try Taskflow ⏳ 2026-01-01` (today's date) to any note — it appears in To-do.
4. Optional: create a `Projects/Active` folder (configurable) and give each project note a `status: now|next|later` frontmatter field. Select inbox tasks in the panel and move them into a project — the lines are physically cut into the project note, subtasks included.

## The workflow model

Tasks are checkbox lines in the [Tasks plugin's emoji format](https://publish.obsidian.md/tasks/Reference/Task+Formats/Tasks+Emoji+Format). `⏳` is the day you plan to work on it — slideable without guilt. `📅` is a real external deadline — rare, always a debt once it arrives. A task belongs to a project because its line lives in that project's note; there are no project tags. Triage means emptying the inbox: give each capture a date, a project, or a cancellation.

## Playing well with others

Taskflow interoperates through shared markdown, not APIs (see `docs/adr/0004`):

- **Tasks** owns parsing and completion side effects.
- **Day Planner** owns time: Taskflow never reads or writes daily-note `# Events:` sections.
- **Kanban**: the heading that moved tasks land under is configurable, so a project note that becomes a board keeps working.
- **Sync tools**: if some tool machine-writes a note in your vault (an Apple Reminders sync, for example), point the "Machine-managed note" setting at it — its dated reminders show and nag, its scheduled time-blocks stay hidden, and its rows allow check-off only, so the next sync never clobbers a panel edit.

## Credits

Taskflow began as a fork of [obsidian-checklist-plugin](https://github.com/delashum/obsidian-checklist-plugin) by delashum, whose minimalist card-list UI it keeps. MIT licensed; original license retained.
