import type {SectionKey} from '../settings'
import type {DropTarget} from '../core/drop'
import type {QuickDate} from '../core/schedule'
import type {SetupMessageKey} from '../core/setup'
import type {PacingMode, ProjectMeta, Sections, TaskflowTask} from '../core/types'

export type PanelData = {
  sections: Sections | null
  /** Environment message keys (core/setup.ts); the panel renders them as copy. */
  setup: SetupMessageKey[]
  today: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
  /** Folded project groups, keyed by project note path. */
  collapsedProjects: Record<string, boolean>
  /** Rows can be dragged to section and project headers (desktop only). */
  draggable: boolean
  /** locationKey of the task in focus (#16), or null — highlights its row. */
  focusLocation: string | null
  /** Machine-managed rows get check-off only (core/machine-note.ts, ADR-0003). */
  machineNotePath: string
  /** Membership is location (CONTEXT.md); drop validity needs it too. */
  projectsFolder: string
  /** Inbox captures render inside To-do; drop validity must know them. */
  dailyNotesFolder: string
  inboxHeading: string
  /** For the template-missing hint; '' means the built-in scaffold. */
  templatePath: string
  /** Which pacing signals to render: wip hides chips, deadline hides the badge. */
  pacingMode: PacingMode
}

/** What only the row knows when its menu opens (#19): the select state. */
export type RowMenuState = {
  /** The row's section has a select mode (To-do, Backlogs). */
  selectable: boolean
  selected: boolean
}

/** Everything a task row needs regardless of which section rendered it. */
export type RowContext = {
  today: string
  focusLocation: string | null
  machineNotePath: string
  /** Desktop drag: rows lift, headers catch. The drag state lives in the panel. */
  draggable: boolean
  onDragStart: (task: TaskflowTask) => void
  onDragEnd: () => void
  callbacks: PanelCallbacks
}

export type PanelCallbacks = {
  onToggleTask: (task: TaskflowTask) => void
  /** The MouseEvent carries the open modifiers (mod+click → new tab, etc.). */
  onOpenTask: (task: TaskflowTask, ev?: MouseEvent) => void
  onOpenFile: (path: string, ev?: MouseEvent) => void
  onCollapse: (key: SectionKey, collapsed: boolean) => void
  onCollapseProject: (path: string, collapsed: boolean) => void
  /** Header click: fold, or jump to the note when the open-modifier is held. */
  onProjectToggle: (path: string, folded: boolean, ev: MouseEvent) => void
  /** Opens the quick-date menu (today / tomorrow / weekend / pick) at the event. */
  onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) => void
  /** The 📅 chip's menu (#18): pick or remove the due date — never the plan. */
  onDueMenu: (task: TaskflowTask, ev: MouseEvent) => void
  /** The row's context menu: every hover affordance, for right-click and touch. */
  onRowMenu: (task: TaskflowTask, ev: MouseEvent, row: RowMenuState) => void
  /** The 🍅 act (#16): start a focus session on this task, no note opened. */
  onStartFocus: (task: TaskflowTask) => void
  onSchedule: (task: TaskflowTask, kind: QuickDate) => void
  /** Removes the ⏳ plan — puts a To-do task back to wherever it lives. */
  onUnschedule: (task: TaskflowTask) => void
  onPickDate: (task: TaskflowTask) => void
  onCancelTask: (task: TaskflowTask) => void
  onRescheduleAllSlipped: () => void
  /** A section header's "…" menu; `selecting` labels the toggle-select item. */
  onSectionMenu: (key: SectionKey, selecting: boolean, ev: MouseEvent) => void
  /** Triage: open the project picker for the selected inbox tasks. */
  onBulkMove: (tasks: TaskflowTask[]) => void
  onBulkScheduleMenu: (tasks: TaskflowTask[], ev: MouseEvent) => void
  /** Narrow panels: the select bar's two buttons folded into one "…" menu. */
  onBulkActionsMenu: (tasks: TaskflowTask[], ev: MouseEvent) => void
  /** A drop names an existing edit; core resolves which one (dropIntent). */
  onDrop: (task: TaskflowTask, target: DropTarget, ev: DragEvent) => void
  /** Project lifecycle menu: status now/next/later, done/dropped + archive. */
  onProjectMenu: (project: ProjectMeta, ev: MouseEvent) => void
  /** The deadline chip's act — a chip opens what edits it (panel grammar). */
  onProjectDeadline: (project: ProjectMeta) => void
  /** The pressing loop's one tap: commit a pressing project to `now`. */
  onPromoteProject: (project: ProjectMeta) => void
}
