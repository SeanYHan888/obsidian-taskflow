import {assert, test} from 'vitest'

import {classifySections} from '../src/core/classify'
import {locationKey} from '../src/core/hierarchy'
import {
  pruneSelection,
  retirePlan,
  sectionCounts,
  selectionSpan,
  selectionTasks,
  wipBadge,
} from '../src/core/sections'

import type {ClassifyConfig, ProjectMeta, TaskflowTask} from '../src/core/types'

const CONFIG: ClassifyConfig = {
  today: '2026-08-21',
  dailyNotesFolder: 'Daily Notes',
  projectsFolder: 'Projects/Active',
  machineNotePath: '',
  inboxHeading: 'Inbox',
  pacingMode: 'hybrid',
  pressWindow: 7,
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

const project = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  path: 'Projects/Active/colm-paper.md',
  name: 'colm-paper',
  status: 'now',
  deadline: null,
  order: null,
  ...overrides,
})

test('a selection spans To-do, its inbox tail, and the backlogs — not slipped or upcoming', () => {
  const sections = classifySections(
    [
      task({description: 'today', scheduled: '2026-08-21'}),
      task({description: 'capture', heading: 'Inbox'}),
      task({description: 'backlog', filePath: 'Projects/Active/colm-paper.md'}),
      task({description: 'slipped', scheduled: '2026-08-19'}),
      task({description: 'ahead', scheduled: '2026-08-30'}),
    ],
    [project()],
    CONFIG,
  )
  assert.deepEqual(
    selectionSpan(sections)
      .map(t => t.description)
      .sort(),
    ['backlog', 'capture', 'today'],
  )
  assert.deepEqual(selectionSpan(null), [])
})

test('a task dated today renders twice but a selection edits its line once', () => {
  const dual = task({
    description: 'dual',
    filePath: 'Projects/Active/colm-paper.md',
    scheduled: '2026-08-21',
  })
  const sections = classifySections([dual], [project()], CONFIG)
  // The same line appears in both To-do and its project group…
  assert.lengthOf(selectionSpan(sections), 2)
  // …but selecting it yields one task.
  const key = locationKey(dual.filePath, dual.line)
  assert.lengthOf(selectionTasks(sections, new Set([key])), 1)
})

test('pruning drops keys whose line left the projection', () => {
  const kept = task({description: 'kept', scheduled: '2026-08-21'})
  const sections = classifySections([kept], [], CONFIG)
  const pruned = pruneSelection(
    sections,
    new Set([locationKey(kept.filePath, kept.line), 'Gone.md:12']),
  )
  assert.deepEqual([...pruned], [locationKey(kept.filePath, kept.line)])
})

test('counts include nested subtasks; a null projection counts zero everywhere', () => {
  const parent = task({description: 'parent', scheduled: '2026-08-21', line: 10})
  const child = task({
    description: 'child',
    scheduled: '2026-08-21',
    line: 11,
    parentLine: 10,
  })
  const sections = classifySections([parent, child], [], CONFIG)
  assert.equal(sectionCounts(sections).today, 2)
  assert.deepEqual(sectionCounts(null), {today: 0, slipped: 0, upcoming: 0, inbox: 0, projects: 0})
})

test('the WIP badge appears with any now-project and warns only past the limit', () => {
  const busy = classifySections(
    [
      task({filePath: 'Projects/Active/colm-paper.md'}),
      task({filePath: 'Projects/Active/b.md', line: 20}),
    ],
    [project(), project({path: 'Projects/Active/b.md', name: 'b'})],
    CONFIG,
  )
  assert.deepEqual(wipBadge(busy, 3, 'hybrid'), {label: 'now 2/3', danger: false})
  assert.deepEqual(wipBadge(busy, 1, 'hybrid'), {label: 'now 2/1', danger: true})
  const idle = classifySections([], [project({status: 'later'})], CONFIG)
  assert.isNull(wipBadge(idle, 3, 'hybrid'))
})

test('retiring confirms only while open tasks would leave the panel', () => {
  const parent = task({
    description: 'parent',
    filePath: 'Projects/Active/colm-paper.md',
    line: 10,
  })
  const child = task({
    description: 'child',
    filePath: 'Projects/Active/colm-paper.md',
    line: 11,
    parentLine: 10,
  })
  const sections = classifySections([parent, child], [project()], CONFIG)
  assert.deepEqual(retirePlan(sections, 'Projects/Active/colm-paper.md'), {
    openCount: 2,
    needsConfirm: true,
  })
  assert.deepEqual(retirePlan(sections, 'Projects/Active/other.md'), {
    openCount: 0,
    needsConfirm: false,
  })
  assert.deepEqual(retirePlan(null, 'Projects/Active/colm-paper.md'), {
    openCount: 0,
    needsConfirm: false,
  })
})
