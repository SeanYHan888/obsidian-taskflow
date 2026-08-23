import {inFolder} from './classify'
import {isMachineManaged} from './machine-note'

import type {MachineNoteConfig} from './machine-note'
import type {QuickDate} from './schedule'
import type {ProjectMeta, ProjectStatus, TaskflowTask} from './types'

/**
 * Menus as data: core decides which items exist, what they say, and what
 * they mean; the view only turns a spec into an Obsidian Menu and dispatches
 * the chosen action. The policy (when Remove date appears, when a project can
 * be refiled) is testable here without a DOM.
 */

export type MenuAction =
  | {type: 'schedule'; kind: QuickDate}
  | {type: 'pick-date'}
  | {type: 'remove-date'}
  | {type: 'move-to-project'}
  | {type: 'send-back'}
  | {type: 'cancel'}
  | {type: 'open-note'}
  | {type: 'set-status'; status: ProjectStatus}
  | {type: 'pick-deadline'}
  | {type: 'clear-deadline'}
  | {type: 'retire'; status: 'done' | 'dropped'}

export type MenuItemSpec =
  | {kind: 'item'; title: string; icon: string; action: MenuAction; disabled?: boolean}
  | {kind: 'separator'}

const item = (
  title: string,
  icon: string,
  action: MenuAction,
  disabled = false,
): MenuItemSpec => ({kind: 'item', title, icon, action, disabled})

const separator: MenuItemSpec = {kind: 'separator'}

/**
 * The quick-date menu, for one task or a bulk selection. Remove date appears
 * once anything has a plan to withdraw; the two refiling acts (move, send
 * back) only when every task lives in a project note — a mixed selection
 * has no one source to send back from.
 */
export const scheduleMenuSpec = (
  tasks: readonly TaskflowTask[],
  config: {projectsFolder: string},
): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = [
    item('To-do (today)', 'sun', {type: 'schedule', kind: 'today'}),
    item('Tomorrow', 'sunrise', {type: 'schedule', kind: 'tomorrow'}),
    item('Weekend', 'armchair', {type: 'schedule', kind: 'weekend'}),
    item('Pick a date…', 'calendar', {type: 'pick-date'}),
  ]
  const hasPlan = tasks.some(t => t.scheduled != null)
  const fromProject =
    tasks.length > 0 && tasks.every(t => inFolder(t.filePath, config.projectsFolder))
  if (hasPlan || fromProject) spec.push(separator)
  if (hasPlan) spec.push(item('Remove date', 'eraser', {type: 'remove-date'}))
  if (fromProject) {
    spec.push(item('Move to project…', 'folder-input', {type: 'move-to-project'}))
    spec.push(item('Send back to inbox', 'inbox', {type: 'send-back'}))
  }
  return spec
}

/**
 * A task row's context menu: every hover affordance again, plus the jump —
 * hover doesn't exist on mobile, so the menu is the touch-parity surface.
 * A machine-managed row offers only the jump (its line is read-only).
 */
export const taskMenuSpec = (
  task: TaskflowTask,
  config: {projectsFolder: string} & MachineNoteConfig,
): MenuItemSpec[] => {
  const open = item('Open in note', 'file-text', {type: 'open-note'})
  if (isMachineManaged(task.filePath, config)) return [open]
  return [
    open,
    separator,
    ...scheduleMenuSpec([task], config),
    separator,
    item('Cancel task', 'x', {type: 'cancel'}),
  ]
}

const STATUS_ICON: Record<ProjectStatus, string> = {
  now: 'play',
  next: 'clock',
  later: 'moon',
}

/** The project lifecycle menu: navigate, commit, pace, retire. */
export const projectMenuSpec = (project: ProjectMeta): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = [
    item('Open project note', 'file-text', {type: 'open-note'}),
    separator,
  ]
  for (const status of ['now', 'next', 'later'] as ProjectStatus[]) {
    spec.push(
      item(
        status === project.status ? `${status} ✓` : status,
        STATUS_ICON[status],
        {type: 'set-status', status},
        status === project.status,
      ),
    )
  }
  spec.push(separator)
  spec.push(
    item(
      project.deadline == null ? 'Set deadline…' : `Deadline ${project.deadline}…`,
      'calendar-clock',
      {type: 'pick-deadline'},
    ),
  )
  if (project.deadline != null) {
    spec.push(item('Clear deadline', 'eraser', {type: 'clear-deadline'}))
  }
  spec.push(separator)
  spec.push(item('Mark done & archive', 'check-circle', {type: 'retire', status: 'done'}))
  spec.push(item('Mark dropped & archive', 'circle-off', {type: 'retire', status: 'dropped'}))
  return spec
}
