import type {SectionKey} from '../settings'
import type {QuickDate} from '../core/schedule'
import type {Sections, TaskflowTask} from '../core/types'

export type PanelData = {
  sections: Sections | null
  tasksPluginMissing: boolean
  today: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
  /** filePath → label shown next to a task (project name or daily-note day). */
  sourceLabels: Record<string, string>
  /** Tasks here get check-off only — the note is machine-rewritten (ADR-0003). */
  appleSyncPath: string
}

/** Everything a task row needs regardless of which section rendered it. */
export type RowContext = {
  today: string
  sourceLabels: Record<string, string>
  appleSyncPath: string
  callbacks: PanelCallbacks
}

export type PanelCallbacks = {
  onToggleTask: (task: TaskflowTask) => void
  onOpenTask: (task: TaskflowTask) => void
  onOpenFile: (path: string) => void
  onCollapse: (key: SectionKey, collapsed: boolean) => void
  /** Opens the quick-date menu (today / tomorrow / weekend / pick) at the event. */
  onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) => void
  onSchedule: (task: TaskflowTask, kind: QuickDate) => void
  onPickDate: (task: TaskflowTask) => void
  onCancelTask: (task: TaskflowTask) => void
  onRescheduleAllSlipped: () => void
}
