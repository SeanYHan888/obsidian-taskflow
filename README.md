# Taskflow

An Obsidian sidebar panel that turns daily-note capture into project execution. Four sections over your vault's tasks:

1. **Today** — tasks scheduled (`⏳`) or due (`📅`) today. Nothing from the past.
2. **Overdue & slipped** — past-due and past-scheduled tasks, with one-tap reschedule.
3. **Inbox** — undated tasks captured in your daily notes. Multi-select them and move them into a project.
4. **Projects** — open tasks in your active project notes, grouped by project, `now` → `next` → `later`, with a WIP badge.

Taskflow is stateless: your markdown is the database, the panel is a projection. It reads live from the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin (emoji format) and completes tasks through the Tasks API, so done-dates and any downstream sync keep working. It is a task panel, not a calendar — time blocks belong to Day Planner.

## Requirements

- The [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin, in emoji format mode.
- Projects as notes in a projects folder (default `Projects/Active/`) with `status: now|next|later` frontmatter.
- Daily notes with an `# Inbox` heading for capture.

Folder paths, headings, and the WIP limit are configurable in settings.

## Status

Early development — v0.1 (read-only sections + check-off) in progress. Roadmap in the repo issues.

## Credits

Taskflow began as a fork of [obsidian-checklist-plugin](https://github.com/delashum/obsidian-checklist-plugin) by delashum, whose minimalist card-list UI it keeps. MIT licensed; original license retained.
