import {assert, test} from 'vitest'

import {
  dueMenuSpec,
  projectMenuSpec,
  scheduleMenuSpec,
  sectionMenuSpec,
  selectBarMenuSpec,
  taskMenuSpec,
} from '../src/core/menus'

import type {MenuItemSpec} from '../src/core/menus'
import type {ProjectMeta, TaskflowTask} from '../src/core/types'

const CONFIG = {
  projectsFolder: 'Projects/Active',
  today: '2026-08-24',
  machineNotePath: '',
  focusedLocation: null,
}

let nextLine = 0
const task = (overrides: Partial<TaskflowTask> = {}): TaskflowTask => ({
  description: 'a task',
  filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  line: nextLine++,
  sourceLine: '- [ ] a task',
  open: true,
  scheduled: null,
  due: null,
  heading: null,
  children: [],
  ...overrides,
})

const titles = (spec: MenuItemSpec[]) =>
  spec.map(entry => (entry.kind === 'item' ? entry.title : '—'))

test('an undated daily task gets the four quick dates and nothing else', () => {
  assert.deepEqual(titles(scheduleMenuSpec([task()], CONFIG)), [
    'To-do (today)',
    'Tomorrow',
    'Weekend',
    'Pick a date…',
  ])
})

test('remove date appears once anything has a plan to withdraw', () => {
  const spec = scheduleMenuSpec([task(), task({scheduled: '2026-08-25'})], CONFIG)
  assert.include(titles(spec), 'Remove date')
})

test('a quick date every selected task already holds is ✓ and disabled', () => {
  const spec = scheduleMenuSpec([task({scheduled: '2026-08-24'})], CONFIG)
  const items = spec.filter(e => e.kind === 'item')
  const today = items.find(e => e.title.startsWith('To-do'))
  assert.equal(today?.title, 'To-do (today) ✓')
  assert.isTrue(today?.disabled)
  const tomorrow = items.find(e => e.title.startsWith('Tomorrow'))
  assert.equal(tomorrow?.title, 'Tomorrow')
  assert.isFalse(tomorrow?.disabled)
})

test('a mixed selection marks no quick date', () => {
  const spec = scheduleMenuSpec([task({scheduled: '2026-08-24'}), task()], CONFIG)
  assert.notInclude(titles(spec), 'To-do (today) ✓')
})

test('refiling acts appear only when every task lives in a project note', () => {
  const backlog = task({filePath: 'Projects/Active/colm-paper.md'})
  const all = titles(scheduleMenuSpec([backlog], CONFIG))
  assert.include(all, 'Move to project…')
  assert.include(all, 'Send back to To-do')

  const mixed = titles(scheduleMenuSpec([backlog, task()], CONFIG))
  assert.notInclude(mixed, 'Move to project…')
  assert.notInclude(mixed, 'Send back to To-do')

  assert.notInclude(titles(scheduleMenuSpec([], CONFIG)), 'Move to project…')
})

test('user-facing copy never says inbox (#13)', () => {
  const backlog = task({filePath: 'Projects/Active/colm-paper.md', scheduled: '2026-08-24'})
  for (const title of titles(taskMenuSpec(backlog, CONFIG))) {
    assert.notMatch(title, /inbox/i)
  }
})

const HYBRID = {pacingMode: 'hybrid' as const, pressing: false}

const project = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  path: 'Projects/Active/colm-paper.md',
  name: 'colm-paper',
  status: 'now',
  deadline: null,
  ...overrides,
})

test('the current status is checked and disabled; the others actionable', () => {
  const spec = projectMenuSpec(project({status: 'next'}), HYBRID)
  const items = spec.filter(e => e.kind === 'item')
  const next = items.find(e => e.title.startsWith('next'))
  assert.equal(next?.title, 'next ✓')
  assert.isTrue(next?.disabled)
  const now = items.find(e => e.title === 'now')
  assert.isFalse(now?.disabled)
})

test('clear deadline exists only once a deadline is set', () => {
  assert.notInclude(titles(projectMenuSpec(project(), HYBRID)), 'Clear deadline')
  const dated = projectMenuSpec(project({deadline: '2026-09-01'}), HYBRID)
  assert.include(titles(dated), 'Clear deadline')
  assert.include(titles(dated), 'Deadline 2026-09-01…')
})

test('both menus open with the same jump and close with the destructive acts', () => {
  const projectTitles = titles(projectMenuSpec(project(), HYBRID))
  assert.equal(projectTitles[0], 'Open note')
  assert.deepEqual(projectTitles.slice(-2), ['Mark done & archive', 'Mark dropped & archive'])

  const taskTitles = titles(taskMenuSpec(task(), CONFIG))
  assert.equal(taskTitles[0], 'Open note')
  assert.equal(taskTitles.at(-1), 'Cancel task')
})

test('the project menu carries the capture act, pressing puts the commit first', () => {
  const calm = titles(projectMenuSpec(project(), HYBRID))
  assert.include(calm, 'Add task…')
  assert.notInclude(calm, 'Move to now')

  const pressing = titles(projectMenuSpec(project(), {...HYBRID, pressing: true}))
  assert.isBelow(pressing.indexOf('Move to now'), pressing.indexOf('Add task…'))
})

test('a machine-managed row offers the jump and the focus session, nothing else', () => {
  const managed = task({filePath: 'Sync/Reminders.md'})
  assert.deepEqual(
    titles(taskMenuSpec(managed, {...CONFIG, machineNotePath: 'Sync/Reminders.md'})),
    ['Open note', '—', 'Start focus'],
  )
})

test('every task menu carries Start focus right after the jump (#16)', () => {
  const spec = titles(taskMenuSpec(task(), CONFIG))
  assert.deepEqual(spec.slice(0, 3), ['Open note', '—', 'Start focus'])
})

test('the focused task marks its own Start focus ✓ and disabled (#16)', () => {
  const focused = task()
  const spec = taskMenuSpec(focused, {
    ...CONFIG,
    focusedLocation: `${focused.filePath}:${focused.line}`,
  })
  const items = spec.filter(e => e.kind === 'item')
  const focus = items.find(e => e.title.startsWith('Start focus'))
  assert.equal(focus?.title, 'Start focus ✓')
  assert.isTrue(focus?.disabled)

  const other = taskMenuSpec(task(), {...CONFIG, focusedLocation: 'somewhere else:0'})
  const otherFocus = other.filter(e => e.kind === 'item').find(e => e.title.startsWith('Start focus'))
  assert.isFalse(otherFocus?.disabled)
})

test('the section menu carries the acts: select for selectable, repair for slipped', () => {
  const selectable = titles(sectionMenuSpec({selecting: false, selectable: true, repairable: false}))
  assert.deepEqual(selectable, ['Select tasks…'])

  const selecting = titles(sectionMenuSpec({selecting: true, selectable: true, repairable: false}))
  assert.deepEqual(selecting, ['Done selecting'])

  const repair = titles(sectionMenuSpec({selecting: false, selectable: false, repairable: true}))
  assert.deepEqual(repair, ['Reschedule all to today'])
})

test('a section with no acts gets an empty spec — no menu at all', () => {
  assert.deepEqual(sectionMenuSpec({selecting: false, selectable: false, repairable: false}), [])
})

test('the select bar overflow prepends move-to-project for triage selections only', () => {
  const triage = titles(selectBarMenuSpec([task()], CONFIG))
  assert.equal(triage[0], 'Move to project…')
  assert.include(triage, 'To-do (today)')

  const refile = selectBarMenuSpec([task({filePath: 'Projects/Active/colm-paper.md'})], CONFIG)
  const moves = refile.filter(e => e.kind === 'item' && e.action.type === 'move-to-project')
  assert.lengthOf(moves, 1)
})

test('the due chip opens a menu that edits the due field only — no quick dates (#18)', () => {
  assert.deepEqual(titles(dueMenuSpec(task({due: '2026-09-05'}))), ['Pick a date…', 'Remove due date'])
  assert.deepEqual(titles(dueMenuSpec(task())), ['Pick a date…'])
  for (const entry of dueMenuSpec(task({due: '2026-09-05'}))) {
    if (entry.kind === 'item') assert.match(entry.action.type, /due/)
  }
})

test('the row menu offers the due date after the plan items, in the pacing group (#18)', () => {
  const undated = titles(taskMenuSpec(task(), CONFIG))
  assert.isAbove(undated.indexOf('Set due date…'), undated.indexOf('Pick a date…'))
  assert.notInclude(undated, 'Remove due date')

  const dated = titles(taskMenuSpec(task({due: '2026-09-05'}), CONFIG))
  assert.include(dated, 'Due 2026-09-05…')
  assert.include(dated, 'Remove due date')

  // In a project note the refile group follows; the due items stay ahead of it.
  const inProject = titles(taskMenuSpec(task({filePath: 'Projects/Active/Taxes.md'}), CONFIG))
  assert.isBelow(inProject.indexOf('Set due date…'), inProject.indexOf('Move to project…'))
  assert.equal(inProject[inProject.indexOf('Set due date…') + 1], '—')
})

test('bulk schedule menus never carry due items — one row, its own deadline (#18)', () => {
  const bulk = titles(scheduleMenuSpec([task(), task({due: '2026-09-05'})], CONFIG))
  assert.notInclude(bulk, 'Set due date…')
  assert.notInclude(bulk, 'Remove due date')
})
