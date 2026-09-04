import type {JournalEntry} from './journal'
import type {ProjectMeta, ProjectStatus, TaskflowTask} from './types'

/**
 * What the core needs from the outside world, as three narrow contracts
 * (ADR-0004). One adapter each — the port's value is the named surface and
 * the single place vendor internals live, not hypothetical substitution.
 * Every port returns live projections and edits source lines in place:
 * nothing caches tasks or mints identifiers (ADR-0001). The clock is not a
 * port — `today` is an injected value everywhere.
 */

/** Where tasks come from and how they complete. The one adapter wraps the Tasks plugin; its object shapes, plugin id, and event names stay behind this seam. */
export type TaskSource = {
  /** Absence is a first-class state the panel explains, never an error. */
  available(): boolean
  read(): TaskflowTask[]
  /** Completion goes through the source of truth or not at all (ADR-0001). */
  toggle(task: TaskflowTask): Promise<void>
  /** Fires when the source's projection may have changed; returns unsubscribe. */
  onChange(listener: () => void): () => void
}

/** Project notes: frontmatter reads and writes, lifecycle, creation. */
export type ProjectStore = {
  read(): ProjectMeta[]
  setStatus(path: string, status: ProjectStatus): Promise<boolean>
  setDeadline(path: string, deadline: string | null): Promise<boolean>
  /** Manual rank (#20); null clears it. */
  setOrder(path: string, order: number | null): Promise<boolean>
  /** Terminal statuses move the note to the archive; task lines are never touched. */
  archive(path: string, status: 'done' | 'dropped'): Promise<boolean>
  /** Returns the created (or existing same-name) note's path, or null. */
  create(name: string, today: string): Promise<string | null>
}

export type MoveOutcome = {moved: number; entry: JournalEntry | null}

/** A completed work interval, ready for the two focus writes (#16). */
export type FocusSessionRecord = {
  /** Epoch ms, injected by the shell's clock. */
  startedAt: number
  endedAt: number
  workMinutes: number
  /** The task's text at session start — logged even when its line is gone. */
  taskText: string
}

/**
 * Every task-line write except completion. Each edit verifies the line
 * against the task's read-time fingerprint (`sourceLine`) — stale lines are
 * skipped and reported, never guessed at — and changed lines come back as a
 * journal entry so the action can be undone.
 */
export type LineEditor = {
  reschedule(tasks: TaskflowTask[], date: string): Promise<JournalEntry | null>
  unschedule(tasks: TaskflowTask[]): Promise<JournalEntry | null>
  /** The 📅 field's own writers (#18) — scheduling never touches it. */
  setDue(tasks: TaskflowTask[], date: string): Promise<JournalEntry | null>
  clearDue(tasks: TaskflowTask[]): Promise<JournalEntry | null>
  cancel(task: TaskflowTask): Promise<JournalEntry | null>
  moveToProject(tasks: TaskflowTask[], projectPath: string): Promise<MoveOutcome>
  sendBackToInbox(tasks: TaskflowTask[], today: string): Promise<MoveOutcome>
  /** Appends one new task line under the project's move-target heading. */
  addTask(projectPath: string, text: string): Promise<JournalEntry | null>
  /**
   * The focus timer's two completion writes (#16): bump `[🍅:: n]` on the
   * task's line (skipped when the task is null — vanished mid-session — or
   * machine-managed, where the next rewrite would eat it) and append the
   * session to the Focus Log. One journal entry, undoable together.
   */
  recordFocusSession(
    task: TaskflowTask | null,
    session: FocusSessionRecord,
  ): Promise<JournalEntry | null>
}

export type Ports = {
  tasks: TaskSource
  projects: ProjectStore
  editor: LineEditor
}
