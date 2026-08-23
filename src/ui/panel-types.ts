import type {SectionKey} from '../settings'
import type {DropTarget} from '../core/drop'
import type {QuickDate} from '../core/schedule'
import type {SetupMessageKey} from '../core/setup'
import type {ProjectMeta, Sections, TaskflowTask} from '../core/types'

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
  /** Machine-managed rows get check-off only (core/machine-note.ts, ADR-0003). */
  machineNotePath: string
  /** Membership is location (CONTEXT.md); drop validity needs it too. */
  projectsFolder: string
  /** For the template-missing hint; '' means the built-in scaffold. */
  templatePath: string
}

/** Everything a task row needs regardless of which section rendered it. */
export type RowContext = {
  today: string
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
  /** The row's context menu: every hover affordance, for right-click and touch. */
  onRowMenu: (task: TaskflowTask, ev: MouseEvent) => void
  onSchedule: (task: TaskflowTask, kind: QuickDate) => void
  /** Removes the ⏳ plan — puts a To-do task back to wherever it lives. */
  onUnschedule: (task: TaskflowTask) => void
  onPickDate: (task: TaskflowTask) => void
  onCancelTask: (task: TaskflowTask) => void
  onRescheduleAllSlipped: () => void
  /** Triage: open the project picker for the selected inbox tasks. */
  onBulkMove: (tasks: TaskflowTask[]) => void
  onBulkScheduleMenu: (tasks: TaskflowTask[], ev: MouseEvent) => void
  /** A drop names an existing edit; core resolves which one (dropIntent). */
  onDrop: (task: TaskflowTask, target: DropTarget, ev: DragEvent) => void
  /** Project lifecycle menu: status now/next/later, done/dropped + archive. */
  onProjectMenu: (project: ProjectMeta, ev: MouseEvent) => void
}
