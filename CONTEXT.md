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
A real external deadline. Rare; mostly arrives via Apple Reminders sync or is typed into a daily note. Edited only by its own chip's **due menu** (pick / remove — no quick dates, a deadline is picked, never guessed) and the row menu's "Set due date…"; scheduling never touches it, and a task holding both fields shows both chips (#18).
_Avoid_: deadline (in code/UI — the emoji vocabulary is Tasks-plugin canon)

**Undated**:
A task with neither scheduled nor due date. Undated means untriaged (in a daily note) or backlog (in a project note).

**Slipped**:
A task whose scheduled day has passed without completion. A slipped calendar block from the Apple Sync note is not slipped — a missed calendar event is not a debt.
_Avoid_: overdue (reserved for past **due** dates)

**Overdue**:
A task whose due date has passed. Always a debt, even in the Apple Sync note.

### Sections (the panel's projections)

**To-do**:
The panel's first section: open tasks scheduled or due today, followed by the undated inbox captures. Nothing from the past, and no calendar blocks — the Apple Sync note's Calendar section never appears here. The execution surface and the triage queue, one working list (merged 2026-08-22).
_Avoid_: Today (renamed 2026-08-22; the dated-today rule is unchanged)

**Overdue & slipped**:
Open tasks due before today, or scheduled before today outside the Apple Sync note. A repair queue: reschedule, complete, or cancel.

**Inbox**:
Undated open tasks under a daily note's `# Inbox` heading, rendered at the tail of the To-do section. A triage queue: give each task a date, a project, or a cancellation. Checkboxes under other headings are not Taskflow's business. An internal name only: the panel presents this surface as part of To-do, and user-facing copy (menu items, notices, empty states) says To-do, never inbox (#13).
_Avoid_: capture list, unsorted, inbox (in UI copy)

**Upcoming**:
Open tasks dated later than today, outside the projects folder — visible while they wait, so scheduling ahead never makes a task disappear. Collapsed by default.
_Avoid_: scheduled (as a section name — ⏳ is the field, Upcoming is the projection)

**Backlog**:
The open tasks in one project's note. Grouped by project in the panel's fourth section.

### Projects

**Project**:
A note in `Projects/Active/` with `status` frontmatter. Membership is location: a task belongs to a project because its line lives in that note's `## Tasks`.
_Avoid_: project tags on task lines

**Status (now / next / later)**:
Project-level commitment frontmatter. `now` = being worked, `next` = queued, `later` = someday. Lifecycle continues to `done` / `dropped` on retirement to `Projects/Archive/`. Orders the undated Backlogs and tiebreaks equal deadlines — a project deadline outranks it.

**WIP limit**:
How many projects `now` may hold (configurable, default 3). Exceeding it warns (red badge), never blocks.

**Project deadline**:
Optional `deadline` frontmatter (ISO date) on a project note — a project-level commitment date, distinct from a task's due (📅) field. Dated projects lead the Backlogs soonest-first; undated ones follow in status order. The header chip is amber while ahead, red once arrived — the same urgency grammar as task due chips. Rendered in the deadline and hybrid pacing modes; capacity mode ignores it (the frontmatter stays).

**Pacing mode (capacity / deadlines / hybrid)**:
Which pacing signals the Backlogs render and act on. Capacity (`wip`): the WIP badge only, status order. Deadlines (`deadline`): chips and deadline-first sort, no badge. Hybrid (default): both signals plus the pressing loop. A pure rendering filter — statuses and deadlines live in frontmatter regardless, so switching is instant and lossless.

**Pressing**:
Hybrid mode's reconciliation signal: a project whose deadline is inside the attention window (`pressWindow` days, default 7, arrival included) while its status isn't `now` — the calendar and the commitments disagree. A pressing header offers a hover-revealed `→ now` (and a "Move to now" menu item); one tap commits, ignoring it is a legitimate refusal. Promoting past the WIP limit goes through and the notice names the consequence — warn, never block, on both signals at once.
_Avoid_: urgent, overdue (pressing is about commitment, not the chip's color)

**Triage**:
The act of emptying the Inbox: moving a task to a project, stamping a date, or cancelling it.

**Move to project**:
Physically cutting a task line (with its subtask children) out of its source note into a project note's `## Tasks`. Not a copy, not a link. The source may be a daily note (triage) or another project note (refiling) — the cut defines the move, not the source. Reachable from every row's context menu (#19), the select bar, and a drop on a project header; "Send back to To-do" is the project-row-only inverse. The row menu's "Select" (selectable sections only) enters select mode with that row in hand.

**Events (`# Events:`)**:
Day Planner's section of the daily note — time blocks, not tasks. Taskflow never reads or writes it.

### Panel grammar

The rules every menu and affordance obeys (#14), so the next one has a rule to follow instead of a precedent to drift from:

**Menu order**:
Every context menu reads navigate → capture/commit → pacing → refile → destructive, separators only between non-empty sections. The first item is always the jump ("Open note", file-text); destructive acts are always last. An item naming a state the thing is already in is marked "✓" and disabled — project statuses and quick dates alike.

**Chip rule**:
A chip opens what edits it: the ⏳ chip (and the add-date button) opens the schedule menu, the 📅 chip opens the due menu, the project deadline chip opens the deadline picker. Chips are the only date-shaped buttons on any row or header.

**Quick-button rule**:
At most one quick button per header, shown only when the panel is pressing for a decision — today: `→ now` on a pressing project header — in the one shared quick-action style, always mirrored by a menu item. (The repair queue's `All → to-do` was retired to its section menu's "Reschedule all to today": one visible accelerator vocabulary, not two.)

**Header chrome**:
Signals (the count, the WIP badge) sit with the title inside the fold toggle; the right edge of any header holds acts only — a `…` menu when the section has acts (#15). Mode toggles (select) are menu items, not buttons: a mode is not a pressing decision. A header with no acts (Upcoming) shows nothing, by rule. On project headers the deadline chip renders last, past the hover-revealed `…`, so at rest every date in the panel — task chips and project deadlines — sits flush against the same right edge.

**Primary-click rule**:
Primary click does the surface's dominant act — task text jumps, project name folds. Because a header's click folds, headers carry a visible … entry point; rows carry none. The jump on a header is mod+click, middle-click, or the menu's Open note (the ↗ button was retired — three paths didn't need a fourth). The context menu (right-click, long-press) carries every act on both surfaces: visible buttons are accelerators, never the only path.

### Focus (the timer, #16)

**Focus session**:
A pomodoro-style work interval bound to one task, started from its row — no note opened. One at a time; it lives on the plugin, so it outlives the panel but not an Obsidian restart. UI copy says focus, never pomodoro — 🍅 is the glyph and the inline-field key.
_Avoid_: pomodoro (in UI copy), timer (as the session's name)

**Work interval**:
The timed stretch of a focus session (default 40 min). Only a fully elapsed work interval writes: bump `[🍅:: n]` on the task's line (the `n/m` estimate form moves only `n`; machine-managed lines are skipped) and append the session to the Focus Log — one journal entry, undoable together. Cancels — explicit, task-switch, or check-off of the focused task — write nothing.

**Break interval**:
The rest after a completed work interval (default 5 min; 0 skips it). Notified, never logged — only worked time enters the record.

**Focus Log**:
The one note where completed work sessions are appended, one line each (`**WORK(40m)**: 14:19 - 14:59 — task text`); path in settings, created on first use. The single time record — its older anonymous lines stay valid.

### Sources

**Daily note**:
A note under `Daily Notes/` (pattern `YYYY/MM/MM-DD, ddd`). Where tasks are captured.

**Machine-managed note**:
The one configured note some external tool rewrites on its own schedule (optional; blank means the vault has none). Two rules follow from "machine-rewritten," both stated once in `core/machine-note.ts`: its ⏳-dated lines are calendar blocks and are never projected, and its rows are read-only in the panel except check-off. Any sync tool that owns a note fits.
_Avoid_: Apple Sync path (as the concept's name — Apple Sync is one instance)

**Apple Sync note**:
`Indexes/System/Apple Sync.md`, machine-written every 15 minutes by apple-planner-sync — the machine-managed note in Sean's vault. Its Reminders section (📅) is Taskflow's business; its Calendar section (⏳ time blocks) is Day Planner's world and is never projected. Check-off propagates back to Apple Reminders; any other edit gets clobbered on next sync.
