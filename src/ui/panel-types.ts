import type {SectionKey} from '../settings'
import type {Sections, TaskflowTask} from '../core/types'

export type PanelData = {
  sections: Sections | null
  tasksPluginMissing: boolean
  today: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
  /** filePath → label shown next to a task (project name or daily-note day). */
  sourceLabels: Record<string, string>
}

export type PanelCallbacks = {
  onToggleTask: (task: TaskflowTask) => void
  onOpenTask: (task: TaskflowTask) => void
  onOpenFile: (path: string) => void
  onCollapse: (key: SectionKey, collapsed: boolean) => void
}
