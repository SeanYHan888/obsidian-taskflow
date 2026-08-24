import {assert, test} from 'vitest'

import {projectMenuSpec, scheduleMenuSpec, taskMenuSpec} from '../src/core/menus'

import type {MenuItemSpec} from '../src/core/menus'
import type {ProjectMeta, TaskflowTask} from '../src/core/types'

const CONFIG = {projectsFolder: 'Projects/Active', today: '2026-08-24', machineNotePath: ''}

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

test('a machine-managed row offers only the jump', () => {
  const managed = task({filePath: 'Sync/Reminders.md'})
  assert.deepEqual(
    titles(taskMenuSpec(managed, {...CONFIG, machineNotePath: 'Sync/Reminders.md'})),
    ['Open note'],
  )
})
