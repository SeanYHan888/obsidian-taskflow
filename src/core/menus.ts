import {inFolder} from './classify'
import {locationKey} from './hierarchy'
import {isMachineManaged} from './machine-note'
import {resolveQuickDate} from './schedule'

import type {MachineNoteConfig} from './machine-note'
import type {QuickDate} from './schedule'
import type {MoveDirection} from './order'
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
  | {type: 'pick-due-date'}
  | {type: 'remove-due-date'}
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
  | {type: 'select'}
  | {type: 'move'; direction: MoveDirection}
  | {type: 'organize'}
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
  const refile = bulkRefileItems(tasks, config)
  return refile.length === 0
    ? planItems(tasks, config)
    : [...planItems(tasks, config), separator, ...refile]
}

/** The pacing group's plan items: quick dates, the picker, and Remove date. */
const planItems = (tasks: readonly TaskflowTask[], config: ScheduleMenuConfig): MenuItemSpec[] => {
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
  return spec
}

const MOVE_TO_PROJECT = item('Move to project…', 'folder-input', {type: 'move-to-project'})
const SEND_BACK = item('Send back to To-do', 'inbox', {type: 'send-back'})

/**
 * A selection's refile group: only when every task lives in a project note,
 * since a mixed selection has no one source to send back from (triage
 * selections get their move on the select bar instead).
 */
const bulkRefileItems = (
  tasks: readonly TaskflowTask[],
  config: ScheduleMenuConfig,
): MenuItemSpec[] => {
  const fromProject =
    tasks.length > 0 && tasks.every(t => inFolder(t.filePath, config.projectsFolder))
  return fromProject ? [MOVE_TO_PROJECT, SEND_BACK] : []
}

/**
 * One row's refile group (#19): any row can be moved to a project — triage
 * from the daily note is one right-click away — and a row already in a
 * project can also be sent back.
 */
const rowRefileItems = (task: TaskflowTask, config: ScheduleMenuConfig): MenuItemSpec[] =>
  inFolder(task.filePath, config.projectsFolder) ? [MOVE_TO_PROJECT, SEND_BACK] : [MOVE_TO_PROJECT]

/**
 * The 📅 chip's menu (#18): a chip opens what edits it, and this one edits
 * the due field only. No quick dates — a deadline is an external fact, not a
 * plan, so it is picked, never guessed at from "weekend".
 */
export const dueMenuSpec = (task: TaskflowTask): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = [item('Pick a date…', 'calendar-clock', {type: 'pick-due-date'})]
  if (task.due != null) spec.push(item('Remove due date', 'eraser', {type: 'remove-due-date'}))
  return spec
}

/**
 * The row menu's due items: one row, its own deadline. Sits after the plan
 * items in the pacing group, in the project menu's deadline vocabulary.
 */
const dueItems = (task: TaskflowTask): MenuItemSpec[] => {
  const spec: MenuItemSpec[] = [
    item(
      task.due == null ? 'Set due date…' : `Due ${task.due}…`,
      'calendar-clock',
      {type: 'pick-due-date'},
    ),
  ]
  if (task.due != null) spec.push(item('Remove due date', 'eraser', {type: 'remove-due-date'}))
  return spec
}

export type FocusMenuConfig = {
  /** locationKey of the task in focus, or null — marks its row's item ✓. */
  focusedLocation: string | null
}

export type SelectMenuConfig = {
  /** Whether the row's section has a select mode (To-do, Backlogs). */
  selectable: boolean
  /** Already in the selection — its Select item is ✓ and disabled. */
  selected: boolean
}

/**
 * A task row's context menu: every hover affordance again, plus the jump —
 * hover doesn't exist on mobile, so the menu is the touch-parity surface.
 * Grammar: jump · focus and (in a selectable section) Select · plan and due
 * · refile · destructive. A machine-managed row keeps the jump and the
 * focus session (which only appends to the log — the line increment is the
 * adapter's rule to skip); its line itself stays read-only.
 */
export const taskMenuSpec = (
  task: TaskflowTask,
  config: ScheduleMenuConfig & MachineNoteConfig & FocusMenuConfig & SelectMenuConfig,
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
  const select = config.selectable
    ? [item(config.selected ? 'Select ✓' : 'Select', 'copy-check', {type: 'select'}, config.selected)]
    : []
  return [
    open,
    separator,
    focus,
    ...select,
    separator,
    ...planItems([task], config),
    ...dueItems(task),
    separator,
    ...rowRefileItems(task, config),
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
  /** The Backlogs: carries Organize by status (#20). */
  organizable: boolean
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
  if (config.organizable) {
    spec.push(item('Organize by status', 'arrow-down-narrow-wide', {type: 'organize'}))
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
  /**
   * Which moves can change anything (#20): up/top need a project above,
   * down/bottom one below; an arrived deadline leads regardless of rank, so
   * both are false and the four items render disabled.
   */
  canMove: {up: boolean; down: boolean}
}

const MOVES: {direction: MoveDirection; title: string; icon: string; needs: 'up' | 'down'}[] = [
  {direction: 'top', title: 'Move to top', icon: 'arrow-up-to-line', needs: 'up'},
  {direction: 'up', title: 'Move up', icon: 'arrow-up', needs: 'up'},
  {direction: 'down', title: 'Move down', icon: 'arrow-down', needs: 'down'},
  {direction: 'bottom', title: 'Move to bottom', icon: 'arrow-down-to-line', needs: 'down'},
]

/**
 * The project lifecycle menu, in the same grammar as the task menu: the jump,
 * then capture/commit (a pressing project puts "Move to now" first — the
 * touch-parity twin of the header's hover → now — and "Add task…" is capture
 * straight into the backlog), then pacing (status and, outside wip mode,
 * deadline — wip has no deadline concept to edit), then the four moves that
 * arrange the list by hand (#20), then retirement.
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
  for (const {direction, title, icon, needs} of MOVES) {
    spec.push(item(title, icon, {type: 'move', direction}, !config.canMove[needs]))
  }
  spec.push(separator)
  spec.push(item('Mark done & archive', 'check-circle', {type: 'retire', status: 'done'}))
  spec.push(item('Mark dropped & archive', 'circle-off', {type: 'retire', status: 'dropped'}))
  return spec
}
