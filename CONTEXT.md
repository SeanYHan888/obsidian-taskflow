# Taskflow

The sidebar panel that projects the vault's daily-note → project task workflow into four sections. Every task lives in exactly one markdown file; every view (this panel included) is a projection. Taskflow is the reminder; Day Planner is the calendar — time blocks are never Taskflow's business.

## Language

### Tasks and dates

**Task**:
One markdown checkbox line in the vault. Its file is its home; it has no identity beyond its line.
_Avoid_: todo, item, card

**Scheduled (⏳)**:
The day the user plans to work on a task. Slideable without guilt; the only date most tasks ever get.

**Due (📅)**:
A real external deadline. Rare; mostly arrives via Apple Reminders sync.
_Avoid_: deadline (in code/UI — the emoji vocabulary is Tasks-plugin canon)

**Undated**:
A task with neither scheduled nor due date. Undated means untriaged (in a daily note) or backlog (in a project note).

**Slipped**:
A task whose scheduled day has passed without completion. A slipped calendar block from the Apple Sync note is not slipped — a missed calendar event is not a debt.
_Avoid_: overdue (reserved for past **due** dates)

**Overdue**:
A task whose due date has passed. Always a debt, even in the Apple Sync note.

### Sections (the panel's projections)

**Today**:
Open tasks scheduled or due today. Nothing from the past, and no calendar blocks — the Apple Sync note's Calendar section never appears here. The execution surface.

**Overdue & slipped**:
Open tasks due before today, or scheduled before today outside the Apple Sync note. A repair queue: reschedule, complete, or cancel.

**Inbox**:
Undated open tasks under a daily note's `# Inbox` heading. A triage queue: give each task a date, a project, or a cancellation. Checkboxes under other headings are not Taskflow's business.
_Avoid_: capture list, unsorted

**Backlog**:
The open tasks in one project's note. Grouped by project in the panel's fourth section.

### Projects

**Project**:
A note in `Projects/Active/` with `status` frontmatter. Membership is location: a task belongs to a project because its line lives in that note's `## Tasks`.
_Avoid_: project tags on task lines

**Status (now / next / later)**:
Project-level commitment frontmatter. `now` = being worked, `next` = queued, `later` = someday. Lifecycle continues to `done` / `dropped` on retirement to `Projects/Archive/`.

**WIP limit**:
At most 3 projects in `now`. Exceeding it warns (red badge), never blocks.

**Triage**:
The act of emptying the Inbox: moving a task to a project, stamping a date, or cancelling it.

**Move to project**:
Physically cutting a task line (with its subtask children) out of a daily note into a project note's `## Tasks`. Not a copy, not a link.

**Events (`# Events:`)**:
Day Planner's section of the daily note — time blocks, not tasks. Taskflow never reads or writes it.

### Sources

**Daily note**:
A note under `Daily Notes/` (pattern `YYYY/MM/MM-DD, ddd`). Where tasks are captured.

**Apple Sync note**:
`Indexes/System/Apple Sync.md`, machine-written every 15 minutes by apple-planner-sync. Its Reminders section (📅) is Taskflow's business; its Calendar section (⏳ time blocks) is Day Planner's world and is never projected. Check-off propagates back to Apple Reminders; any other edit gets clobbered on next sync.
