import {assert, test} from 'vitest'

import {undoRecordsInFile} from '../src/core/journal'

test('undoing a replace restores what the line said before', () => {
  const lines = ['# Inbox', '- [ ] call bank ⏳ 2026-08-23']

  const result = undoRecordsInFile(lines, [
    {
      kind: 'replace',
      file: 'Daily Notes/08-22.md',
      line: 1,
      before: '- [ ] call bank',
      after: '- [ ] call bank ⏳ 2026-08-23',
    },
  ])

  assert.deepEqual(result.lines, ['# Inbox', '- [ ] call bank'])
  assert.equal(result.reverted, 1)
  assert.equal(result.stale, 0)
})

test('a line edited since the action is skipped, never guessed at', () => {
  const lines = ['- [ ] call bank ⏳ 2026-08-23 #urgent']

  const result = undoRecordsInFile(lines, [
    {
      kind: 'replace',
      file: 'Daily Notes/08-22.md',
      line: 0,
      before: '- [ ] call bank',
      after: '- [ ] call bank ⏳ 2026-08-23',
    },
  ])

  assert.deepEqual(result.lines, ['- [ ] call bank ⏳ 2026-08-23 #urgent'])
  assert.equal(result.reverted, 0)
  assert.equal(result.stale, 1)
})

test('undoing inserts removes the appended block, whatever order records come in', () => {
  const lines = ['## Tasks', '- [ ] existing', '- [ ] moved in', '  - [ ] its child']

  const result = undoRecordsInFile(lines, [
    {kind: 'insert', file: 'Projects/Active/colm-paper.md', line: 2, text: '- [ ] moved in'},
    {kind: 'insert', file: 'Projects/Active/colm-paper.md', line: 3, text: '  - [ ] its child'},
  ])

  assert.deepEqual(result.lines, ['## Tasks', '- [ ] existing'])
  assert.equal(result.reverted, 2)
  assert.equal(result.stale, 0)
})

test('an inserted line that changed since stays put and counts as stale', () => {
  const lines = ['## Tasks', '- [x] moved in, then done']

  const result = undoRecordsInFile(lines, [
    {kind: 'insert', file: 'Projects/Active/colm-paper.md', line: 1, text: '- [ ] moved in'},
  ])

  assert.deepEqual(result.lines, ['## Tasks', '- [x] moved in, then done'])
  assert.equal(result.reverted, 0)
  assert.equal(result.stale, 1)
})

test('undoing removals rebuilds the note exactly, non-adjacent cuts included', () => {
  // Forward action cut lines 1 and 3 out of:
  //   ['# Inbox', '- [ ] alpha', '- [ ] keep', '- [ ] gamma']
  const lines = ['# Inbox', '- [ ] keep']

  const result = undoRecordsInFile(lines, [
    {kind: 'remove', file: 'Daily Notes/08-22.md', line: 1, text: '- [ ] alpha'},
    {kind: 'remove', file: 'Daily Notes/08-22.md', line: 3, text: '- [ ] gamma'},
  ])

  assert.deepEqual(result.lines, ['# Inbox', '- [ ] alpha', '- [ ] keep', '- [ ] gamma'])
  assert.equal(result.reverted, 2)
  assert.equal(result.stale, 0)
})

test('re-inserting a removed line clamps to the end of a shrunken note', () => {
  const lines = ['# Inbox']

  const result = undoRecordsInFile(lines, [
    {kind: 'remove', file: 'Daily Notes/08-22.md', line: 9, text: '- [ ] alpha'},
  ])

  assert.deepEqual(result.lines, ['# Inbox', '- [ ] alpha'])
  assert.equal(result.reverted, 1)
  assert.equal(result.stale, 0)
})

test('a removed line already restored by hand is not duplicated — skipped as stale', () => {
  const lines = ['# Inbox', '- [ ] alpha', '- [ ] keep']

  const result = undoRecordsInFile(lines, [
    {kind: 'remove', file: 'Daily Notes/08-22.md', line: 1, text: '- [ ] alpha'},
  ])

  assert.deepEqual(result.lines, ['# Inbox', '- [ ] alpha', '- [ ] keep'])
  assert.equal(result.reverted, 0)
  assert.equal(result.stale, 1)
})
