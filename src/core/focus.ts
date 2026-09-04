import type {TaskflowTask} from './types'

/**
 * The focus timer (#16): a pomodoro-style work interval bound to one task.
 * Clockless like the rest of core — every transition takes the current time
 * as an argument; the shell owns the interval that calls it. Only a fully
 * elapsed work interval writes anywhere: cancels (explicit, task-switch, or
 * check-off of the focused task) and break intervals never do.
 */

export type FocusConfig = {workMinutes: number; breakMinutes: number}

export type FocusState =
  | {phase: 'idle'}
  | {phase: 'work'; task: TaskflowTask; startedAt: number; endsAt: number; workMinutes: number}
  | {phase: 'break'; endsAt: number}

export const IDLE_FOCUS: FocusState = {phase: 'idle'}

/** A work interval that fully elapsed — the only event that reaches a file. */
export type CompletedWork = {
  task: TaskflowTask
  startedAt: number
  endedAt: number
  workMinutes: number
}

/** One session at a time: starting over a running work interval abandons it. */
export const startFocus = (
  state: FocusState,
  task: TaskflowTask,
  at: number,
  config: FocusConfig,
): {state: FocusState; abandoned: TaskflowTask | null} => ({
  state: {
    phase: 'work',
    task,
    startedAt: at,
    endsAt: at + config.workMinutes * 60_000,
    workMinutes: config.workMinutes,
  },
  abandoned: state.phase === 'work' ? state.task : null,
})

export type FocusTick = {
  state: FocusState
  completed: CompletedWork | null
  breakEnded: boolean
}

/**
 * Advances the session to `at`. A completed work interval hands back the
 * session to record and rolls into the break (chained off the scheduled end,
 * so the intervals stay exact even when ticks arrive late); a zero-length
 * break goes straight to idle.
 */
export const tickFocus = (state: FocusState, at: number, config: FocusConfig): FocusTick => {
  if (state.phase === 'work' && at >= state.endsAt) {
    const completed: CompletedWork = {
      task: state.task,
      startedAt: state.startedAt,
      endedAt: state.endsAt,
      workMinutes: state.workMinutes,
    }
    const next: FocusState =
      config.breakMinutes > 0
        ? {phase: 'break', endsAt: state.endsAt + config.breakMinutes * 60_000}
        : IDLE_FOCUS
    return {state: next, completed, breakEnded: false}
  }
  if (state.phase === 'break' && at >= state.endsAt) {
    return {state: IDLE_FOCUS, completed: null, breakEnded: true}
  }
  return {state, completed: null, breakEnded: false}
}

const POMODORO_FIELD = /\[🍅::\s*(\d+)\s*(?:\/\s*(\d+)\s*)?\]/
const TRAILING_BLOCK_REF = /\s+\^[A-Za-z0-9-]+$/

/**
 * Bumps the actual count in the task's inline `[🍅:: n]` field, appending
 * `[🍅:: 1]` when there is none (ahead of a trailing block reference, the
 * same rule the ⏳ stamp follows). The estimate form `[🍅:: n/m]` keeps its
 * denominator: only the actual count ever moves. Everything else on the
 * line — dates, tags, unknown fields — is untouched.
 */
export const incrementPomodoro = (line: string): string => {
  const match = line.match(POMODORO_FIELD)
  if (match) {
    const count = Number.parseInt(match[1], 10) + 1
    const estimate = match[2] == null ? '' : `/${match[2]}`
    return line.replace(POMODORO_FIELD, `[🍅:: ${count}${estimate}]`)
  }
  const blockRef = line.match(TRAILING_BLOCK_REF)
  if (blockRef) {
    return line.slice(0, blockRef.index) + ' [🍅:: 1]' + blockRef[0]
  }
  return `${line} [🍅:: 1]`
}

const hhmm = (at: number): string => {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * One Focus Log line. The task suffix is the new part; the prefix matches
 * the log's existing machine-written lines, which stay valid without it.
 */
export const formatSessionLine = (session: {
  startedAt: number
  endedAt: number
  workMinutes: number
  taskText: string
}): string =>
  `**WORK(${session.workMinutes}m)**: ${hhmm(session.startedAt)} - ${hhmm(session.endedAt)} — ${session.taskText}`

const countdown = (msLeft: number): string => {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

/** The status-bar text, or null when there is nothing to show. */
export const statusBarLabel = (state: FocusState, at: number): string | null => {
  if (state.phase === 'idle') return null
  if (state.phase === 'work') {
    // trimEnd: a blank-description task must not leave a dangling space.
    return `🍅 ${countdown(state.endsAt - at)} ${truncate(state.task.description, 28)}`.trimEnd()
  }
  return `☕ ${countdown(state.endsAt - at)}`
}

/**
 * Finds the session's task in the current projection at completion time. The
 * start-time snapshot is up to a work interval old, so its line number and
 * sourceLine fingerprint may both have drifted (a reschedule mid-session,
 * an edit above the line); same note + same text + still open is the task,
 * preferring the original line when several match. Null means the line is
 * gone (completed, cancelled, reworded) — the log write still happens, the
 * increment has nothing to land on.
 */
export const reanchorTask = (
  snapshot: TaskflowTask,
  tasks: TaskflowTask[],
): TaskflowTask | null => {
  const candidates = tasks.filter(
    t => t.open && t.filePath === snapshot.filePath && t.description === snapshot.description,
  )
  return candidates.find(t => t.line === snapshot.line) ?? candidates[0] ?? null
}
