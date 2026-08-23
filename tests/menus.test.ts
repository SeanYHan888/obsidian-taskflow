import {assert, test} from 'vitest'

import {projectMenuSpec, scheduleMenuSpec} from '../src/core/menus'

import type {MenuItemSpec} from '../src/core/menus'
import type {ProjectMeta, TaskflowTask} from '../src/core/types'

const CONFIG = {projectsFolder: 'Projects/Active'}

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

test('refiling acts appear only when every task lives in a project note', () => {
  const backlog = task({filePath: 'Projects/Active/colm-paper.md'})
  const all = titles(scheduleMenuSpec([backlog], CONFIG))
  assert.include(all, 'Move to project…')
  assert.include(all, 'Send back to inbox')

  const mixed = titles(scheduleMenuSpec([backlog, task()], CONFIG))
  assert.notInclude(mixed, 'Move to project…')
  assert.notInclude(mixed, 'Send back to inbox')

  assert.notInclude(titles(scheduleMenuSpec([], CONFIG)), 'Move to project…')
})

const project = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  path: 'Projects/Active/colm-paper.md',
  name: 'colm-paper',
  status: 'now',
  deadline: null,
  ...overrides,
})

test('the current status is checked and disabled; the others actionable', () => {
  const spec = projectMenuSpec(project({status: 'next'}))
  const items = spec.filter(e => e.kind === 'item')
  const next = items.find(e => e.title.startsWith('next'))
  assert.equal(next?.title, 'next ✓')
  assert.isTrue(next?.disabled)
  const now = items.find(e => e.title === 'now')
  assert.isFalse(now?.disabled)
})

test('clear deadline exists only once a deadline is set', () => {
  assert.notInclude(titles(projectMenuSpec(project())), 'Clear deadline')
  const dated = projectMenuSpec(project({deadline: '2026-09-01'}))
  assert.include(titles(dated), 'Clear deadline')
  assert.include(titles(dated), 'Deadline 2026-09-01…')
})

test('every project menu opens with the note and closes with retirement', () => {
  const all = titles(projectMenuSpec(project()))
  assert.equal(all[0], 'Open project note')
  assert.deepEqual(all.slice(-2), ['Mark done & archive', 'Mark dropped & archive'])
})
