import {assert, test} from 'vitest'

import {cutTaskBlocks, insertUnderHeadingAt} from '../src/core/move'
import {relationsFromLines} from '../src/core/hierarchy'

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

test('insertUnderHeadingAt appends after the last task in the section', () => {
  const lines = [
    '# My Project',
    '',
    '## Tasks',
    '',
    '- [ ] existing task',
    '',
    '## Notes',
  ]

  const result = insertUnderHeadingAt(lines, 'Tasks', [['- [ ] moved', '  - [ ] sub']])?.lines

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

test('insertUnderHeadingAt matches the setting with or without # marks', () => {
  const lines = ['## Tasks', '- [ ] a']

  const result = insertUnderHeadingAt(lines, '## tasks', [['- [ ] b']])?.lines

  assert.deepEqual(result, ['## Tasks', '- [ ] a', '- [ ] b'])
})

test('insertUnderHeadingAt creates a missing heading at the end of the note', () => {
  const lines = ['# My Project', '', 'Some prose.']

  const result = insertUnderHeadingAt(lines, 'Tasks', [['- [ ] moved']])?.lines

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

test('insertUnderHeadingAt places into an empty section right after the heading', () => {
  const lines = ['## Tasks', '', '## Notes']

  const result = insertUnderHeadingAt(lines, 'Tasks', [['- [ ] first']])?.lines

  assert.deepEqual(result, ['## Tasks', '- [ ] first', '', '## Notes'])
})

test('relationsFromLines nests list items by indentation', () => {
  const relations = relationsFromLines([
    '# Inbox',
    '- [ ] parent',
    '  - [ ] child',
    '    - grandchild bullet',
    '  - [ ] second child',
    '- [ ] sibling',
  ])

  assert.deepEqual(relations, [
    {line: 1, parent: -1},
    {line: 2, parent: 1},
    {line: 3, parent: 2},
    {line: 4, parent: 1},
    {line: 5, parent: -1},
  ])
})

test('relationsFromLines resets nesting at prose but tolerates blank lines', () => {
  const relations = relationsFromLines([
    '- [ ] first list',
    '',
    '  - [ ] still a child',
    'Some prose.',
    '  - [ ] indented but a new list',
  ])

  assert.deepEqual(relations, [
    {line: 0, parent: -1},
    {line: 2, parent: 0},
    {line: 4, parent: -1},
  ])
})

test('insertUnderHeadingAt honours explicit heading marks when creating', () => {
  const result = insertUnderHeadingAt(['# Board'], '### Doing', [['- [ ] moved']])?.lines

  assert.deepEqual(result, ['# Board', '', '### Doing', '', '- [ ] moved'])
})

test('cutTaskBlocks reports which original line numbers were removed', () => {
  const lines = ['# Inbox', '- [ ] alpha', '- [ ] keep', '- [ ] beta', '  - [ ] beta child']

  const {removedLines} = cutTaskBlocks(lines, [1, 3], [
    {line: 1, parent: -1},
    {line: 2, parent: -1},
    {line: 3, parent: -1},
    {line: 4, parent: 3},
  ])

  assert.deepEqual(removedLines, [1, 3, 4])
})

test('insertUnderHeadingAt reports where the block landed', () => {
  const lines = ['## Tasks', '- [ ] existing', '', '## Notes']

  const result = insertUnderHeadingAt(lines, 'Tasks', [['- [ ] moved', '  - [ ] sub']])

  assert.deepEqual(result?.lines, [
    '## Tasks',
    '- [ ] existing',
    '- [ ] moved',
    '  - [ ] sub',
    '',
    '## Notes',
  ])
  assert.equal(result?.insertAt, 2)
  assert.deepEqual(result?.inserted, ['- [ ] moved', '  - [ ] sub'])
})

test('insertUnderHeadingAt refuses when the heading is missing and creation is off', () => {
  const lines = ['# 08-22, Sat', '', '## Events:']

  const result = insertUnderHeadingAt(lines, 'Inbox', [['- [ ] back to triage']], {
    createMissing: false,
  })

  assert.equal(result, null)
})

test('a project-note source keeps date-bearing lines byte-identical through cut-and-append', () => {
  const source = [
    '# colm-paper',
    '',
    '## Tasks',
    '- [ ] camera ready paper ⏳ 2026-08-25 📅 2026-08-30',
    '  - [ ] fix figure 3 ⏳ 2026-08-24',
    '- [ ] stays behind',
  ]

  const {blocks} = cutTaskBlocks(source, [3], relationsFromLines(source))
  const target = ['# llm-study', '', '## Tasks', '- [ ] existing task']
  const insertion = insertUnderHeadingAt(target, 'Tasks', blocks, {createMissing: false})

  assert.deepEqual(insertion?.inserted, [
    '- [ ] camera ready paper ⏳ 2026-08-25 📅 2026-08-30',
    '  - [ ] fix figure 3 ⏳ 2026-08-24',
  ])
})
