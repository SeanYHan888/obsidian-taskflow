import {inFolder} from './classify'
import {locationKey} from './hierarchy'
import {isMachineManaged} from './machine-note'
import {resolveQuickDate} from './schedule'

import type {MachineNoteConfig} from './machine-note'
import type {QuickDate} from './schedule'
import type {PacingMode, ProjectMeta, ProjectStatus, TaskflowTask} from './types'

/**
 * Menus as data: core decides which items exist, what they say, and what
 * they mean; the view only turns a spec into an Obsidian Menu and dispatches
 * the chosen action. The policy (when Remove date appears, when a project can
 * be refiled) is testable here without a DOM.
 *
 * Both builders are instances of the one panel grammar (CONTEXT.md): navigate,
 * then capture/commit, then pacing, then refile, then destructive — separators
 * only between non-empty sections, first item always the jump ("Open note"),
 * destructive acts always last, and any item naming a state the thing is
 * already in marked "✓" and disabled.
 */

export type MenuAction =
  | {type: 'schedule'; kind: QuickDate}
  | {type: 'pick-date'}
  | {type: 'remove-date'}
  | {type: 'move-to-project'}
  | {type: 'send-back'}
  | {type: 'cancel'}
  | {type: 'open-note'}
  | {type: 'start-focus'}
  | {type: 'add-task'}
  | {type: 'promote'}
  | {type: 'set-status'; status: ProjectStatus}
  | {type: 'pick-deadline'}
  | {type: 'clear-deadline'}
  | {type: 'retire'; status: 'done' | 'dropped'}
  | {type: 'toggle-select'}
  | {type: 'reschedule-all'}

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

const QUICK_DATES: {kind: QuickDate; title: string; icon: string}[] = [
  {kind: 'today', title: 'To-do (today)', icon: 'sun'},
  {kind: 'tomorrow', title: 'Tomorrow', icon: 'sunrise'},
  {kind: 'weekend', title: 'Weekend', icon: 'armchair'},
]

export type ScheduleMenuConfig = {projectsFolder: string; today: string}

/**
 * The quick-date menu, for one task or a bulk selection: the pacing section
 * (a quick date every selected task already holds is marked ✓ and disabled,
 * the same state-marking the status items use; Remove date appears once
 * anything has a plan to withdraw), then the refile section — only when
 * every task lives in a project note, since a mixed selection has no one
 * source to send back from.
 */
export const scheduleMenuSpec = (
  tasks: readonly TaskflowTask[],
  config: ScheduleMenuConfig,
): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = QUICK_DATES.map(({kind, title, icon}) => {
    const held =
      tasks.length > 0 &&
      tasks.every(t => t.scheduled === resolveQuickDate(kind, config.today))
    return item(held ? `${title} ✓` : title, icon, {type: 'schedule', kind}, held)
  })
  spec.push(item('Pick a date…', 'calendar', {type: 'pick-date'}))
  if (tasks.some(t => t.scheduled != null)) {
    spec.push(item('Remove date', 'eraser', {type: 'remove-date'}))
  }
  const fromProject =
    tasks.length > 0 && tasks.every(t => inFolder(t.filePath, config.projectsFolder))
  if (fromProject) {
    spec.push(separator)
    spec.push(item('Move to project…', 'folder-input', {type: 'move-to-project'}))
    spec.push(item('Send back to To-do', 'inbox', {type: 'send-back'}))
  }
  return spec
}

export type FocusMenuConfig = {
  /** locationKey of the task in focus, or null — marks its row's item ✓. */
  focusedLocation: string | null
}

/**
 * A task row's context menu: every hover affordance again, plus the jump —
 * hover doesn't exist on mobile, so the menu is the touch-parity surface.
 * A machine-managed row keeps the jump and the focus session (which only
 * appends to the log — the line increment is the adapter's rule to skip);
 * its line itself stays read-only.
 */
export const taskMenuSpec = (
  task: TaskflowTask,
  config: ScheduleMenuConfig & MachineNoteConfig & FocusMenuConfig,
): MenuItemSpec[] => {
  const open = item('Open note', 'file-text', {type: 'open-note'})
  const focused = config.focusedLocation === locationKey(task.filePath, task.line)
  const focus = item(
    focused ? 'Start focus ✓' : 'Start focus',
    'timer',
    {type: 'start-focus'},
    focused,
  )
  if (isMachineManaged(task.filePath, config)) return [open, separator, focus]
  return [
    open,
    separator,
    focus,
    separator,
    ...scheduleMenuSpec([task], config),
    separator,
    item('Cancel task', 'x', {type: 'cancel'}),
  ]
}

export type SectionMenuConfig = {
  /** The one global select mode's current state — either header toggles it. */
  selecting: boolean
  /** Whether this section's rows can join the selection (To-do, Projects). */
  selectable: boolean
  /** The repair queue: Overdue & slipped. */
  repairable: boolean
}

/**
 * A section header's "…" menu (#15): the header-chrome half of the panel
 * grammar. Acts live here — the only visible exception is the pressing
 * accelerator ("All → to-do" on the repair queue), which this menu mirrors
 * so the button stays a shortcut, never the only path. A section with no
 * acts (Upcoming) gets an empty spec and renders no menu at all.
 */
export const sectionMenuSpec = (config: SectionMenuConfig): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = []
  if (config.selectable) {
    spec.push(
      item(config.selecting ? 'Done selecting' : 'Select tasks…', 'copy-check', {
        type: 'toggle-select',
      }),
    )
  }
  if (config.repairable) {
    spec.push(item('Reschedule all to today', 'sun', {type: 'reschedule-all'}))
  }
  return spec
}

/**
 * The select bar's narrow-panel overflow: its two buttons as one menu. The
 * schedule menu already is the selection's pacing-and-refile spec; the only
 * gap is triage selections (daily-note tasks), whose move-to-project lives
 * on the bar button rather than in the refile section — so it is prepended
 * when the spec doesn't already carry it.
 */
export const selectBarMenuSpec = (
  tasks: readonly TaskflowTask[],
  config: ScheduleMenuConfig,
): MenuItemSpec[] => {
  const spec = scheduleMenuSpec(tasks, config)
  const hasMove = spec.some(e => e.kind === 'item' && e.action.type === 'move-to-project')
  return hasMove
    ? spec
    : [item('Move to project…', 'folder-input', {type: 'move-to-project'}), separator, ...spec]
}

const STATUS_ICON: Record<ProjectStatus, string> = {
  now: 'play',
  next: 'clock',
  later: 'moon',
}

export type ProjectMenuConfig = {
  pacingMode: PacingMode
  /** From the project's group: hybrid's calendar/commitment disagreement. */
  pressing: boolean
}

/**
 * The project lifecycle menu, in the same grammar as the task menu: the jump,
 * then capture/commit (a pressing project puts "Move to now" first — the
 * touch-parity twin of the header's hover → now — and "Add task…" is capture
 * straight into the backlog), then pacing (status and, outside wip mode,
 * deadline — wip has no deadline concept to edit), then retirement.
 */
export const projectMenuSpec = (
  project: ProjectMeta,
  config: ProjectMenuConfig,
): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = [item('Open note', 'file-text', {type: 'open-note'})]
  spec.push(separator)
  if (config.pressing) {
    spec.push(item('Move to now', 'play', {type: 'promote'}))
  }
  spec.push(item('Add task…', 'plus', {type: 'add-task'}))
  spec.push(separator)
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
  if (config.pacingMode !== 'wip') {
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
  }
  spec.push(separator)
  spec.push(item('Mark done & archive', 'check-circle', {type: 'retire', status: 'done'}))
  spec.push(item('Mark dropped & archive', 'circle-off', {type: 'retire', status: 'dropped'}))
  return spec
}
