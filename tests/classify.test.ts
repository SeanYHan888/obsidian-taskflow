import {assert, test} from 'vitest'

import {classifySections} from '../src/core/classify'

import type {ClassifyConfig, ProjectMeta, TaskflowTask} from '../src/core/types'

const CONFIG: ClassifyConfig = {
  today: '2026-08-21',
  dailyNotesFolder: 'Daily Notes',
  projectsFolder: 'Projects/Active',
  appleSyncPath: 'Indexes/System/Apple Sync.md',
  inboxHeading: 'Inbox',
}

let nextLine = 0
const task = (overrides: Partial<TaskflowTask> = {}): TaskflowTask => ({
  description: 'a task',
  filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  line: nextLine++,
  originalMarkdown: '- [ ] a task',
  open: true,
  scheduled: null,
  due: null,
  heading: null,
  children: [],
  ...overrides,
})

const classify = (
  tasks: TaskflowTask[],
  projects: ProjectMeta[] = [],
  config: Partial<ClassifyConfig> = {},
) => classifySections(tasks, projects, {...CONFIG, ...config})

const descriptions = (tasks: TaskflowTask[]) => tasks.map(t => t.description)

test('today holds open tasks scheduled or due today, from any note', () => {
  const scheduledToday = task({
    description: 'scheduled today',
    scheduled: '2026-08-21',
  })
  const dueToday = task({
    description: 'due today',
    due: '2026-08-21',
    filePath: 'Projects/Active/colm-paper.md',
  })
  const scheduledTomorrow = task({
    description: 'scheduled tomorrow',
    scheduled: '2026-08-22',
  })
  const undated = task({description: 'undated'})
  const doneToday = task({
    description: 'done today',
    scheduled: '2026-08-21',
    open: false,
  })

  const sections = classify([
    scheduledToday,
    dueToday,
    scheduledTomorrow,
    undated,
    doneToday,
  ])

  assert.deepEqual(descriptions(sections.today), [
    'scheduled today',
    'due today',
  ])
})

test('apple sync reminders appear in today but its calendar blocks never do', () => {
  const reminder = task({
    description: 'colm camera ready (Todo List)',
    due: '2026-08-21',
    filePath: CONFIG.appleSyncPath,
    heading: 'Apple Reminders',
  })
  const calendarBlock = task({
    description: '09:00 - 10:00 tiktok oa (Personal)',
    scheduled: '2026-08-21',
    filePath: CONFIG.appleSyncPath,
    heading: '2026-08-21',
  })

  const sections = classify([reminder, calendarBlock])

  assert.deepEqual(descriptions(sections.today), [
    'colm camera ready (Todo List)',
  ])
})

test('slipped holds past-dated tasks sorted by date, overdue reminders included', () => {
  const overdueReminder = task({
    description: 'colm camera ready (Todo List)',
    due: '2026-08-20',
    filePath: CONFIG.appleSyncPath,
    heading: 'Apple Reminders',
  })
  const slippedTwoDaysAgo = task({
    description: 'follow up with advisor',
    scheduled: '2026-08-19',
  })
  const onTimeToday = task({description: 'on time', scheduled: '2026-08-21'})
  const futureTask = task({description: 'future', due: '2026-08-25'})

  const sections = classify([
    overdueReminder,
    slippedTwoDaysAgo,
    onTimeToday,
    futureTask,
  ])

  assert.deepEqual(descriptions(sections.slipped), [
    'follow up with advisor',
    'colm camera ready (Todo List)',
  ])
})

test('a missed apple sync calendar block is not slipped', () => {
  const missedBlock = task({
    description: '[All day] Trash and recycling',
    scheduled: '2026-08-20',
    filePath: CONFIG.appleSyncPath,
    heading: '2026-08-20',
  })

  const sections = classify([missedBlock])

  assert.deepEqual(sections.slipped, [])
})

test('inbox holds undated daily-note tasks under the inbox heading, newest note first', () => {
  const capturedToday = task({
    description: 'read mem-agent paper',
    heading: 'Inbox',
    filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  })
  const capturedYesterday = task({
    description: 'rerun ablation table',
    heading: 'Inbox',
    filePath: 'Daily Notes/2026/08/08-20, Thu.md',
  })
  const underTemp = task({
    description: 'stray under temp',
    heading: 'Temp',
    filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  })
  const underEvents = task({
    description: '08:30 am - 09:00 am morning start',
    heading: 'Events:',
    filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  })
  const datedCapture = task({
    description: 'already scheduled',
    heading: 'Inbox',
    scheduled: '2026-08-25',
  })
  const notDaily = task({
    description: 'meeting note task',
    heading: 'Inbox',
    filePath: 'Areas/meeting.md',
  })
  const lookalikeFolder = task({
    description: 'lookalike folder',
    heading: 'Inbox',
    filePath: 'Daily Notes Archive/08-21.md',
  })

  const sections = classify([
    capturedYesterday,
    capturedToday,
    underTemp,
    underEvents,
    datedCapture,
    notDaily,
    lookalikeFolder,
  ])

  assert.deepEqual(descriptions(sections.inbox), [
    'read mem-agent paper',
    'rerun ablation table',
  ])
})

test('inbox heading matches case-insensitively and ignores # marks in the setting', () => {
  const captured = task({
    description: 'captured',
    heading: 'inbox',
    filePath: 'Daily Notes/2026/08/08-21, Fri.md',
  })

  const sections = classify([captured], [], {inboxHeading: '# Inbox'})

  assert.deepEqual(descriptions(sections.inbox), ['captured'])
})

test('projects group by note ordered now, next, later, then alphabetically', () => {
  const colm: ProjectMeta = {
    path: 'Projects/Active/colm-paper.md',
    name: 'colm-paper',
    status: 'now',
  }
  const devSetup: ProjectMeta = {
    path: 'Projects/Active/dev-setup.md',
    name: 'dev-setup',
    status: 'next',
  }
  const llmStudy: ProjectMeta = {
    path: 'Projects/Active/llm-study.md',
    name: 'llm-study',
    status: 'later',
  }
  const knowledgeBase: ProjectMeta = {
    path: 'Projects/Active/build-knowledge-base.md',
    name: 'build-knowledge-base',
    status: 'now',
  }
  const emptyProject: ProjectMeta = {
    path: 'Projects/Active/obsidian-fix.md',
    name: 'obsidian-fix',
    status: 'now',
  }

  const sections = classify(
    [
      task({description: 'study attention', filePath: llmStudy.path}),
      task({description: 'camera ready paper', filePath: colm.path}),
      task({description: 'install dotfiles', filePath: devSetup.path}),
      task({description: 'collect sources', filePath: knowledgeBase.path}),
    ],
    [colm, devSetup, llmStudy, knowledgeBase, emptyProject],
  )

  assert.deepEqual(
    sections.projects.map(g => g.project.name),
    ['build-knowledge-base', 'colm-paper', 'dev-setup', 'llm-study'],
  )
  assert.deepEqual(descriptions(sections.projects[1].tasks), [
    'camera ready paper',
  ])
  assert.equal(sections.wipNowCount, 3)
})

test('a project task dated today appears in both today and its project group', () => {
  const colm: ProjectMeta = {
    path: 'Projects/Active/colm-paper.md',
    name: 'colm-paper',
    status: 'now',
  }
  const crossCutting = task({
    description: 'test model for lsc-dpo',
    filePath: colm.path,
    scheduled: '2026-08-21',
  })

  const sections = classify([crossCutting], [colm])

  assert.deepEqual(descriptions(sections.today), ['test model for lsc-dpo'])
  assert.deepEqual(descriptions(sections.projects[0].tasks), [
    'test model for lsc-dpo',
  ])
})

test('sections preserve subtask hierarchy and promote orphaned children', () => {
  const colm: ProjectMeta = {
    path: 'Projects/Active/colm-paper.md',
    name: 'colm-paper',
    status: 'now',
  }
  const parent = task({
    description: 'camera ready paper',
    filePath: colm.path,
    line: 10,
  })
  const child = task({
    description: 'fix figure 3',
    filePath: colm.path,
    line: 11,
    parentLine: 10,
  })
  const doneParent = task({
    description: 'done parent',
    filePath: colm.path,
    line: 20,
    open: false,
  })
  const orphan = task({
    description: 'child of a done parent',
    filePath: colm.path,
    line: 21,
    parentLine: 20,
  })

  const sections = classify([parent, child, doneParent, orphan], [colm])

  const backlog = sections.projects[0].tasks
  assert.deepEqual(descriptions(backlog), [
    'camera ready paper',
    'child of a done parent',
  ])
  assert.deepEqual(descriptions(backlog[0].children), ['fix figure 3'])
})

test('blank descriptions are excluded from every section', () => {
  const blank = task({description: '   ', scheduled: '2026-08-21'})

  const sections = classify([blank])

  assert.deepEqual(sections.today, [])
})
