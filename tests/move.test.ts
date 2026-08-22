import {assert, test} from 'vitest'

import {cutTaskBlocks, insertUnderHeading} from '../src/core/move'

test('cutTaskBlocks removes a lone task and returns it as a block', () => {
  const lines = ['# Inbox', '', '- [ ] book dentist', '- [ ] keep me']

  const {remaining, blocks} = cutTaskBlocks(lines, [2], [
    {line: 2, parent: -2},
    {line: 3, parent: -2},
  ])

  assert.deepEqual(blocks, [['- [ ] book dentist']])
  assert.deepEqual(remaining, ['# Inbox', '', '- [ ] keep me'])
})

test('cutTaskBlocks carries descendants and preserves relative indentation', () => {
  const lines = [
    '# Inbox',
    '  - [ ] plan the release',
    '    - [ ] write notes',
    '      - extra detail bullet',
    '  - [ ] unrelated',
  ]

  const {remaining, blocks} = cutTaskBlocks(lines, [1], [
    {line: 1, parent: -1},
    {line: 2, parent: 1},
    {line: 3, parent: 2},
    {line: 4, parent: -1},
  ])

  assert.deepEqual(blocks, [
    ['- [ ] plan the release', '  - [ ] write notes', '    - extra detail bullet'],
  ])
  assert.deepEqual(remaining, ['# Inbox', '  - [ ] unrelated'])
})

test('cutTaskBlocks folds a selected child into its selected ancestor', () => {
  const lines = ['- [ ] parent', '  - [ ] child', '- [ ] other']

  const {remaining, blocks} = cutTaskBlocks(lines, [0, 1], [
    {line: 0, parent: -1},
    {line: 1, parent: 0},
    {line: 2, parent: -1},
  ])

  assert.deepEqual(blocks, [['- [ ] parent', '  - [ ] child']])
  assert.deepEqual(remaining, ['- [ ] other'])
})

test('cutTaskBlocks handles multiple selections in file order', () => {
  const lines = ['- [ ] alpha', '- [ ] beta', '- [ ] gamma']

  const {remaining, blocks} = cutTaskBlocks(lines, [2, 0], [
    {line: 0, parent: -1},
    {line: 1, parent: -1},
    {line: 2, parent: -1},
  ])

  assert.deepEqual(blocks, [['- [ ] alpha'], ['- [ ] gamma']])
  assert.deepEqual(remaining, ['- [ ] beta'])
})

test('insertUnderHeading appends after the last task in the section', () => {
  const lines = [
    '# My Project',
    '',
    '## Tasks',
    '',
    '- [ ] existing task',
    '',
    '## Notes',
  ]

  const result = insertUnderHeading(lines, 'Tasks', [['- [ ] moved', '  - [ ] sub']])

  assert.deepEqual(result, [
    '# My Project',
    '',
    '## Tasks',
    '',
    '- [ ] existing task',
    '- [ ] moved',
    '  - [ ] sub',
    '',
    '## Notes',
  ])
})

test('insertUnderHeading matches the setting with or without # marks', () => {
  const lines = ['## Tasks', '- [ ] a']

  const result = insertUnderHeading(lines, '## tasks', [['- [ ] b']])

  assert.deepEqual(result, ['## Tasks', '- [ ] a', '- [ ] b'])
})

test('insertUnderHeading creates a missing heading at the end of the note', () => {
  const lines = ['# My Project', '', 'Some prose.']

  const result = insertUnderHeading(lines, 'Tasks', [['- [ ] moved']])

  assert.deepEqual(result, [
    '# My Project',
    '',
    'Some prose.',
    '',
    '## Tasks',
    '',
    '- [ ] moved',
  ])
})

test('insertUnderHeading places into an empty section right after the heading', () => {
  const lines = ['## Tasks', '', '## Notes']

  const result = insertUnderHeading(lines, 'Tasks', [['- [ ] first']])

  assert.deepEqual(result, ['## Tasks', '- [ ] first', '', '## Notes'])
})
