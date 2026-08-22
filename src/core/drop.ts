import {inFolder} from './classify'

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
  appleSyncPath: string
  projectsFolder: string
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
  if (task.filePath === config.appleSyncPath) return {kind: 'none'}

  if (target.kind === 'project') {
    if (task.filePath === target.path) return {kind: 'none'}
    return {kind: 'move-to-project', path: target.path}
  }

  if (target.key === 'today') return {kind: 'schedule-today'}
  if (target.key === 'upcoming') return {kind: 'ask-date'}
  if (target.key === 'inbox') {
    if (inFolder(task.filePath, config.projectsFolder)) return {kind: 'send-back-to-inbox'}
    // Only ⏳ can be withdrawn — 📅 is read, never written, so a due-only
    // task has nothing the Inbox drop could edit.
    if (task.scheduled != null) return {kind: 'remove-date'}
  }
  return {kind: 'none'}
}
