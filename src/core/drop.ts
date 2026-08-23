import {isMachineManaged} from './machine-note'

/**
 * Drag and drop adds no write paths: a drop is a way of pointing at an edit
 * that already exists. This mapping is the whole semantics — the UI executes
 * the returned intent through the same callbacks the buttons use.
 */

export type DropTarget =
  | {kind: 'section'; key: 'today' | 'slipped' | 'upcoming' | 'inbox' | 'projects'}
  | {kind: 'project'; path: string}

export type DropIntent =
  | {kind: 'schedule-today'}
  | {kind: 'remove-date'}
  | {kind: 'send-back-to-inbox'}
  | {kind: 'move-to-project'; path: string}
  /** Upcoming needs a date chosen, never guessed — open the quick-date menu. */
  | {kind: 'ask-date'}
  | {kind: 'none'}

export type DropConfig = {
  /** The machine-managed note (see core/machine-note.ts), or '' when none. */
  machineNotePath: string
  projectsFolder: string
  /** ISO date injected by the caller — core never reads the clock. */
  today: string
}

type DroppedTask = {
  filePath: string
  scheduled: string | null
  due: string | null
}

export const dropIntent = (
  task: DroppedTask,
  target: DropTarget,
  config: DropConfig,
): DropIntent => {
  if (isMachineManaged(task.filePath, config)) return {kind: 'none'}

  if (target.kind === 'project') {
    if (task.filePath === target.path) return {kind: 'none'}
    return {kind: 'move-to-project', path: target.path}
  }

  if (target.key === 'today') {
    // A task already dated today lives in To-do — nothing to stamp.
    if (task.scheduled === config.today || task.due === config.today) return {kind: 'none'}
    return {kind: 'schedule-today'}
  }
  if (target.key === 'upcoming') return {kind: 'ask-date'}
  // Capture renders inside To-do (2026-08-22 merge), so the Inbox key has no
  // header to drop on; remove-date and send-back-to-inbox live in the menu.
  return {kind: 'none'}
}
