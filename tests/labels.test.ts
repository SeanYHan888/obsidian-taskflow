import {assert, test} from 'vitest'

import {dateEditLabel, projectDateNotice, sourceLabel} from '../src/core/labels'

test('a source is labeled by its basename, extension dropped', () => {
  assert.equal(sourceLabel('Daily Notes/2026/08/08-21, Fri.md'), '08-21, Fri')
  assert.equal(sourceLabel('Sync/Reminders.md'), 'Reminders')
  assert.equal(sourceLabel('Top.md'), 'Top')
})

test('a project date notice names the edit, and the contradiction when the dates cross (#23)', () => {
  const project = {name: 'course-part-2', start: null, deadline: null}
  assert.equal(
    projectDateNotice(project, {field: 'start', date: '2026-09-21'}),
    'Taskflow: course-part-2 start → 2026-09-21',
  )
  assert.equal(
    projectDateNotice({...project, start: '2026-09-21'}, {field: 'start', date: null}),
    'Taskflow: course-part-2 start cleared',
  )
  assert.equal(
    projectDateNotice({...project, deadline: '2026-09-27'}, {field: 'start', date: '2026-09-28'}),
    'Taskflow: course-part-2 start → 2026-09-28 — start 09-28 is after deadline 09-27',
  )
  assert.equal(
    projectDateNotice({...project, start: '2026-09-28'}, {field: 'deadline', date: '2026-09-27'}),
    'Taskflow: course-part-2 deadline → 2026-09-27 — deadline 09-27 is before start 09-28',
  )
  // The same day is not a contradiction; clearing never is.
  assert.equal(
    projectDateNotice({...project, deadline: '2026-09-27'}, {field: 'start', date: '2026-09-27'}),
    'Taskflow: course-part-2 start → 2026-09-27',
  )
  assert.equal(
    projectDateNotice({...project, start: '2026-09-28'}, {field: 'deadline', date: null}),
    'Taskflow: course-part-2 deadline cleared',
  )
})

test('a task date edit is labelled with the field the menu named: start or due, set or cleared', () => {
  assert.equal(dateEditLabel('start', 3, '2026-09-15'), 'start → 2026-09-15 on 3 tasks')
  assert.equal(dateEditLabel('start', 1, null), 'start cleared on 1 task')
  assert.equal(dateEditLabel('due', 1, '2026-09-20'), 'due → 2026-09-20 on 1 task')
  assert.equal(dateEditLabel('due', 2, null), 'due cleared on 2 tasks')
})
