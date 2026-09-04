import {assert, test} from 'vitest'

import {
  IDLE_FOCUS,
  formatSessionLine,
  incrementPomodoro,
  reanchorTask,
  startFocus,
  statusBarLabel,
  tickFocus,
} from '../src/core/focus'

import type {FocusState} from '../src/core/focus'
import type {TaskflowTask} from '../src/core/types'

const CONFIG = {workMinutes: 40, breakMinutes: 5}
const MINUTE = 60_000

/** Local-time epoch ms, so the formatting tests hold in any timezone. */
const at = (hhmm: string): number => new Date(`2026-08-25T${hhmm}:00`).getTime()

let nextLine = 0
const task = (overrides: Partial<TaskflowTask> = {}): TaskflowTask => ({
  description: 'draft the review',
  filePath: 'Projects/Active/colm-paper.md',
  line: nextLine++,
  sourceLine: '- [ ] draft the review',
  open: true,
  scheduled: null,
  due: null,
  heading: null,
  children: [],
  ...overrides,
})

test('a session runs the configured work interval, then rolls into the break', () => {
  const start = at('14:19')
  const {state} = startFocus(IDLE_FOCUS, task(), start, CONFIG)
  assert.equal(state.phase, 'work')

  const midway = tickFocus(state, start + 20 * MINUTE, CONFIG)
  assert.equal(midway.state, state)
  assert.isNull(midway.completed)

  const done = tickFocus(state, start + 40 * MINUTE, CONFIG)
  assert.equal(done.state.phase, 'break')
  assert.equal(done.completed?.startedAt, start)
  assert.equal(done.completed?.endedAt, start + 40 * MINUTE)
  assert.equal(done.completed?.workMinutes, 40)
})

test('the break chains off the scheduled end and ends back at idle, unlogged', () => {
  const start = at('14:19')
  const {state} = startFocus(IDLE_FOCUS, task(), start, CONFIG)
  // The tick arrives late (a busy main thread): intervals stay exact anyway.
  const done = tickFocus(state, start + 40 * MINUTE + 3000, CONFIG)
  assert.equal(done.state.phase, 'break')

  const resting = tickFocus(done.state, start + 42 * MINUTE, CONFIG)
  assert.isFalse(resting.breakEnded)

  const over = tickFocus(done.state, start + 45 * MINUTE + 3000, CONFIG)
  assert.deepEqual(over, {state: IDLE_FOCUS, completed: null, breakEnded: true})
})

test('a zero-length break goes straight to idle', () => {
  const config = {workMinutes: 40, breakMinutes: 0}
  const start = at('09:00')
  const {state} = startFocus(IDLE_FOCUS, task(), start, config)
  const done = tickFocus(state, start + 40 * MINUTE, config)
  assert.equal(done.state.phase, 'idle')
  assert.isNotNull(done.completed)
  assert.isFalse(done.breakEnded)
})

test('starting over a running session abandons it — one session at a time', () => {
  const first = task({description: 'first task'})
  const second = task({description: 'second task'})
  const started = startFocus(IDLE_FOCUS, first, at('10:00'), CONFIG)
  assert.isNull(started.abandoned)

  const switched = startFocus(started.state, second, at('10:10'), CONFIG)
  assert.equal(switched.abandoned, first)
  assert.isTrue(switched.state.phase === 'work' && switched.state.task === second)
  // The new interval is full-length from the switch, not the leftovers.
  const done = tickFocus(switched.state, at('10:50'), CONFIG)
  assert.equal(done.completed?.startedAt, at('10:10'))
})

test('idle ticks are inert', () => {
  assert.deepEqual(tickFocus(IDLE_FOCUS, at('10:00'), CONFIG), {
    state: IDLE_FOCUS,
    completed: null,
    breakEnded: false,
  })
})

test('incrementPomodoro appends [🍅:: 1] to a line without the field', () => {
  assert.equal(
    incrementPomodoro('- [ ] draft the review ⏳ 2026-08-25'),
    '- [ ] draft the review ⏳ 2026-08-25 [🍅:: 1]',
  )
})

test('incrementPomodoro bumps an existing count in place', () => {
  assert.equal(
    incrementPomodoro('- [ ] draft the review [🍅:: 2] #deep'),
    '- [ ] draft the review [🍅:: 3] #deep',
  )
})

test('the estimate form keeps its denominator — only the actual count moves', () => {
  assert.equal(
    incrementPomodoro('- [ ] draft the review [🍅:: 0/3]'),
    '- [ ] draft the review [🍅:: 1/3]',
  )
  assert.equal(
    incrementPomodoro('- [ ] draft the review [🍅:: 3/3]'),
    '- [ ] draft the review [🍅:: 4/3]',
  )
})

test('incrementPomodoro stays ahead of a trailing block reference', () => {
  assert.equal(
    incrementPomodoro('- [ ] linked task ^abc123'),
    '- [ ] linked task [🍅:: 1] ^abc123',
  )
})

test('incrementPomodoro touches nothing else on the line', () => {
  assert.equal(
    incrementPomodoro('  - [ ] submit form 📅 2026-08-25 ⏳ 2026-08-21 [🍅:: 1] [id:: x]'),
    '  - [ ] submit form 📅 2026-08-25 ⏳ 2026-08-21 [🍅:: 2] [id:: x]',
  )
})

test('the log line carries duration, times, and the task text', () => {
  assert.equal(
    formatSessionLine({
      startedAt: at('14:19'),
      endedAt: at('14:59'),
      workMinutes: 40,
      taskText: 'draft the review',
    }),
    '**WORK(40m)**: 14:19 - 14:59 — draft the review',
  )
})

test('the log line prefix matches the existing anonymous lines', () => {
  const line = formatSessionLine({
    startedAt: at('09:05'),
    endedAt: at('09:45'),
    workMinutes: 40,
    taskText: 'anything',
  })
  assert.match(line, /^\*\*WORK\(40m\)\*\*: 09:05 - 09:45/)
})

test('the status bar counts down the work interval with the task text', () => {
  const start = at('14:19')
  const {state} = startFocus(IDLE_FOCUS, task({description: 'draft the review'}), start, CONFIG)
  assert.equal(statusBarLabel(state, start), '🍅 40:00 draft the review')
  assert.equal(statusBarLabel(state, start + 48_000), '🍅 39:12 draft the review')
})

test('the status bar truncates a long task, shows the break plain, hides idle', () => {
  const long = task({description: 'a very long task description that would flood the bar'})
  const start = at('14:19')
  const {state} = startFocus(IDLE_FOCUS, long, start, CONFIG)
  const label = statusBarLabel(state, start)
  assert.isNotNull(label)
  assert.isTrue((label ?? '').endsWith('…'))

  const rest = tickFocus(state, start + 40 * MINUTE, CONFIG).state
  assert.equal(statusBarLabel(rest, start + 40 * MINUTE), '☕ 5:00')
  assert.isNull(statusBarLabel(IDLE_FOCUS, start))
})

test('reanchorTask follows the task to its current line and fingerprint', () => {
  const snapshot = task({line: 10, sourceLine: '- [ ] draft the review'})
  const drifted = {...snapshot, line: 14, sourceLine: '- [ ] draft the review ⏳ 2026-08-25'}
  assert.equal(reanchorTask(snapshot, [task({description: 'other'}), drifted]), drifted)
})

test('reanchorTask prefers the original line when several rows read the same', () => {
  const snapshot = task({line: 10})
  const twin = {...snapshot, line: 3}
  const same = {...snapshot}
  assert.equal(reanchorTask(snapshot, [twin, same]), same)
})

test('reanchorTask returns null for a vanished or closed task', () => {
  const snapshot = task()
  assert.isNull(reanchorTask(snapshot, []))
  assert.isNull(reanchorTask(snapshot, [{...snapshot, open: false}]))
  assert.isNull(reanchorTask(snapshot, [{...snapshot, description: 'reworded'}]))
})

// The reducer's state is data; a stale reference must never resurrect a
// session. (Guards the shell's habit of holding `this.focus` across awaits.)
test('startFocus never mutates the state it was handed', () => {
  const before: FocusState = IDLE_FOCUS
  startFocus(before, task(), at('10:00'), CONFIG)
  assert.deepEqual(before, {phase: 'idle'})
})
