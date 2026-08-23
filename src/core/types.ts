import type {HierarchyItem} from './hierarchy'

/** One markdown checkbox line, as projected through the task-source port. */
export type TaskflowTask = HierarchyItem & {
  description: string
  /**
   * The exact markdown of the line at read time — the line editor's write
   * fingerprint (a line that no longer matches is stale and gets skipped,
   * never guessed at). Write-contract state, not task identity: no core
   * function reads it.
   */
  sourceLine: string
  /** TODO or IN_PROGRESS — done and cancelled tasks are not open. */
  open: boolean
  /** ⏳ the day the user plans to work on it (ISO date), or null. */
  scheduled: string | null
  /** 📅 a real external deadline (ISO date), or null. */
  due: string | null
  /** Text of the nearest heading above the task, without `#` marks. */
  heading: string | null
  children: TaskflowTask[]
}

export type ProjectStatus = 'now' | 'next' | 'later'

export type ProjectMeta = {
  path: string
  name: string
  status: ProjectStatus | null
  /** Project-level commitment date from frontmatter (ISO), or null. Distinct from a task's due (📅) field. */
  deadline: string | null
}

export type ProjectGroup = {
  project: ProjectMeta
  tasks: TaskflowTask[]
  /** 'ahead' (amber) until the deadline, 'arrived' (red) from that day on, null when undated. */
  urgency: 'ahead' | 'arrived' | null
}

export type ClassifyConfig = {
  /** ISO date injected by the caller — core never reads the clock. */
  today: string
  dailyNotesFolder: string
  projectsFolder: string
  /** The machine-managed note (see core/machine-note.ts), or '' when none. */
  machineNotePath: string
  /** Heading text without `#` marks; capture outside it is not Taskflow's business. */
  inboxHeading: string
}

export type Sections = {
  today: TaskflowTask[]
  slipped: TaskflowTask[]
  /** Future-dated tasks outside the projects folder — visible while they wait. */
  upcoming: TaskflowTask[]
  inbox: TaskflowTask[]
  projects: ProjectGroup[]
  /** Number of projects with status `now`, for the WIP badge. */
  wipNowCount: number
}
