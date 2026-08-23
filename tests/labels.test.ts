import {assert, test} from 'vitest'

import {sourceLabel} from '../src/core/labels'

test('a source is labeled by its basename, extension dropped', () => {
  assert.equal(sourceLabel('Daily Notes/2026/08/08-21, Fri.md'), '08-21, Fri')
  assert.equal(sourceLabel('Sync/Reminders.md'), 'Reminders')
  assert.equal(sourceLabel('Top.md'), 'Top')
})
