import {assert, test} from 'vitest'

import {classifySections} from '../src/core/classify'
import {projectMenuSpec} from '../src/core/menus'
import {promotionOutcome, wipBadge} from '../src/core/sections'

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
const task = (filePath: string): TaskflowTask => ({
  description: 'a task',
  filePath,
  line: nextLine++,
  sourceLine: '- [ ] a task',
  open: true,
  scheduled: null,
  due: null,
  heading: null,
  children: [],
})

const project = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  path: 'Projects/Active/colm-paper.md',
  name: 'colm-paper',
  status: 'next',
  deadline: null,
  order: null,
  ...overrides,
})

const classify = (projects: ProjectMeta[], config: Partial<ClassifyConfig> = {}) =>
  classifySections(
    projects.map(p => task(p.path)),
    projects,
    {...CONFIG, ...config},
  )

test('pressing starts at the window edge, arrival included', () => {
  const at = (deadline: string) =>
    classify([project({deadline})]).projects[0].pressing
  assert.isFalse(at('2026-08-29'), 'one day past the window is quiet')
  assert.isTrue(at('2026-08-28'), 'exactly today + 7 presses')
  assert.isTrue(at('2026-08-21'), 'arrival presses')
  assert.isTrue(at('2026-08-01'), 'long past still presses until answered')
})

test('a now project never presses — the signals already agree', () => {
  const groups = classify([project({status: 'now', deadline: '2026-08-22'})]).projects
  assert.isFalse(groups[0].pressing)
  assert.equal(groups[0].urgency, 'ahead')
})

test('window 0 waits for arrival; undated projects never press', () => {
  assert.isFalse(
    classify([project({deadline: '2026-08-22'})], {pressWindow: 0}).projects[0].pressing,
  )
  assert.isTrue(
    classify([project({deadline: '2026-08-21'})], {pressWindow: 0}).projects[0].pressing,
  )
  assert.isFalse(classify([project()]).projects[0].pressing)
})

test('only hybrid runs the pressing loop', () => {
  const dated = [project({deadline: '2026-08-22'})]
  assert.isTrue(classify(dated).projects[0].pressing)
  assert.isFalse(classify(dated, {pacingMode: 'deadline'}).projects[0].pressing)
  assert.isFalse(classify(dated, {pacingMode: 'wip'}).projects[0].pressing)
})

test('wip mode switches the deadline signal off: no urgency, status order only', () => {
  const soonButLater = project({
    path: 'Projects/Active/b.md',
    name: 'b',
    status: 'later',
    deadline: '2026-08-22',
    order: null,
  })
  const undatedNow = project({path: 'Projects/Active/a.md', name: 'a', status: 'now'})

  const hybrid = classify([soonButLater, undatedNow]).projects
  assert.deepEqual(
    hybrid.map(g => g.project.name),
    ['b', 'a'],
    'hybrid: the dated project leads',
  )
  assert.equal(hybrid[0].urgency, 'ahead')

  const wip = classify([soonButLater, undatedNow], {pacingMode: 'wip'}).projects
  assert.deepEqual(
    wip.map(g => g.project.name),
    ['a', 'b'],
    'wip: status order, deadline ignored',
  )
  assert.isNull(wip[0].urgency)
  assert.isNull(wip[1].urgency)
})

test('the badge shows one signal per mode: hidden only in deadline mode', () => {
  const sections = classify([project({status: 'now'})])
  assert.isNotNull(wipBadge(sections, 3, 'hybrid'))
  assert.isNotNull(wipBadge(sections, 3, 'wip'))
  assert.isNull(wipBadge(sections, 3, 'deadline'))
})

test('promotionOutcome counts the landing, not the takeoff', () => {
  const sections = classify([
    project({path: 'Projects/Active/a.md', name: 'a', status: 'now'}),
    project({path: 'Projects/Active/b.md', name: 'b', status: 'now'}),
    project({path: 'Projects/Active/c.md', name: 'c', deadline: '2026-08-22'}),
  ])
  assert.deepEqual(promotionOutcome(sections, 3), {count: 3, over: false})
  assert.deepEqual(promotionOutcome(sections, 2), {count: 3, over: true})
  assert.deepEqual(promotionOutcome(null, 3), {count: 1, over: false})
})

test('the menu paces by mode: pressing leads with Move to now, wip hides deadlines', () => {
  const titles = (spec: ReturnType<typeof projectMenuSpec>) =>
    spec.map(e => (e.kind === 'item' ? e.title : '—'))

  const pressing = titles(projectMenuSpec(project(), {pacingMode: 'hybrid', pressing: true, canMove: {up: true, down: true}}))
  assert.deepEqual(pressing.slice(0, 3), ['Open note', '—', 'Move to now'])

  const calm = titles(projectMenuSpec(project(), {pacingMode: 'hybrid', pressing: false, canMove: {up: true, down: true}}))
  assert.notInclude(calm, 'Move to now')

  const wip = titles(projectMenuSpec(project(), {pacingMode: 'wip', pressing: false, canMove: {up: true, down: true}}))
  assert.notInclude(wip, 'Set deadline…')

  const dated = titles(
    projectMenuSpec(project({deadline: '2026-09-01'}), {pacingMode: 'deadline', pressing: false, canMove: {up: true, down: true}}),
  )
  assert.include(dated, 'Deadline 2026-09-01…')
  assert.include(dated, 'Clear deadline')
})
