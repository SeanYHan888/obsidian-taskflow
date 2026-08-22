import type {SectionKey} from '../settings'
import type {DropTarget} from '../core/drop'
import type {QuickDate} from '../core/schedule'
import type {Sections, TaskflowTask} from '../core/types'

export type PanelData = {
  sections: Sections | null
  tasksPluginMissing: boolean
  today: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
  /** Folded project groups, keyed by project note path. */
  collapsedProjects: Record<string, boolean>
  /** Rows can be dragged to section and project headers (desktop only). */
  draggable: boolean
  /** filePath → label shown next to a task (project name or daily-note day). */
  sourceLabels: Record<string, string>
  /** Tasks here get check-off only — the note is machine-rewritten (ADR-0003). */
  appleSyncPath: string
  /** Membership is location (CONTEXT.md); drop validity needs it too. */
  projectsFolder: string
}

/** Everything a task row needs regardless of which section rendered it. */
export type RowContext = {
  today: string
  sourceLabels: Record<string, string>
  appleSyncPath: string
  /** Desktop drag: rows lift, headers catch. The drag state lives in the panel. */
  draggable: boolean
  onDragStart: (task: TaskflowTask) => void
  onDragEnd: () => void
  callbacks: PanelCallbacks
}

export type PanelCallbacks = {
  onToggleTask: (task: TaskflowTask) => void
  onOpenTask: (task: TaskflowTask) => void
  onOpenFile: (path: string) => void
  onCollapse: (key: SectionKey, collapsed: boolean) => void
  onCollapseProject: (path: string, collapsed: boolean) => void
  /** Opens the quick-date menu (today / tomorrow / weekend / pick) at the event. */
  onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) => void
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
}
