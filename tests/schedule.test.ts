import {assert, test} from 'vitest'

import {
  cancelLine,
  chipLabel,
  clearDue,
  clearScheduled,
  resolveQuickDate,
  setDue,
  setScheduled,
} from '../src/core/schedule'

test('setScheduled appends ⏳ to an undated line, touching nothing else', () => {
  assert.equal(
    setScheduled('  - [ ] read mem-agent paper #research', '2026-08-22'),
    '  - [ ] read mem-agent paper #research ⏳ 2026-08-22',
  )
})

test('setScheduled replaces an existing ⏳ date in place', () => {
  assert.equal(
    setScheduled('- [ ] follow up with advisor ⏳ 2026-08-19', '2026-08-21'),
    '- [ ] follow up with advisor ⏳ 2026-08-21',
  )
})

test('setScheduled never touches a 📅 due date', () => {
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-25', '2026-08-21'),
    '- [ ] submit form 📅 2026-08-25 ⏳ 2026-08-21',
  )
})

test('setScheduled inserts before a trailing block reference', () => {
  assert.equal(
    setScheduled('- [ ] linked task ^abc123', '2026-08-22'),
    '- [ ] linked task ⏳ 2026-08-22 ^abc123',
  )
})

test('cancelLine flips an open checkbox to cancelled, preserving the rest', () => {
  assert.equal(
    cancelLine('    - [ ] dead idea ⏳ 2026-08-10'),
    '    - [-] dead idea ⏳ 2026-08-10',
  )
})

test('cancelLine leaves non-open lines alone', () => {
  assert.equal(cancelLine('- [x] already done'), '- [x] already done')
})

test('clearScheduled is the inverse of setScheduled', () => {
  const line = '  - [ ] read mem-agent paper #research'
  assert.equal(clearScheduled(setScheduled(line, '2026-08-22')), line)
})

test('clearScheduled keeps 📅 due dates and block refs intact', () => {
  assert.equal(
    clearScheduled('- [ ] submit form 📅 2026-08-25 ⏳ 2026-08-21 ^abc123'),
    '- [ ] submit form 📅 2026-08-25 ^abc123',
  )
})

test('clearScheduled leaves lines without ⏳ alone', () => {
  assert.equal(clearScheduled('- [ ] no plan yet 📅 2026-08-25'), '- [ ] no plan yet 📅 2026-08-25')
})

test('resolveQuickDate handles today, tomorrow, and month rollover', () => {
  assert.equal(resolveQuickDate('today', '2026-08-21'), '2026-08-21')
  assert.equal(resolveQuickDate('tomorrow', '2026-08-31'), '2026-09-01')
})

test('resolveQuickDate weekend means the coming Saturday, or today mid-weekend', () => {
  assert.equal(resolveQuickDate('weekend', '2026-08-21'), '2026-08-22')
  assert.equal(resolveQuickDate('weekend', '2026-08-17'), '2026-08-22')
  assert.equal(resolveQuickDate('weekend', '2026-08-22'), '2026-08-22')
  assert.equal(resolveQuickDate('weekend', '2026-08-23'), '2026-08-23')
})

test('chipLabel says today for today and MM-DD for any other date', () => {
  assert.equal(chipLabel('2026-08-21', '2026-08-21'), 'today')
  assert.equal(chipLabel('2026-08-25', '2026-08-21'), '08-25')
  assert.equal(chipLabel('2026-08-19', '2026-08-21'), '08-19')
})

test('setDue appends 📅 to a line without one, leaving the ⏳ plan alone (#18)', () => {
  assert.equal(
    setDue('- [ ] file taxes ⏳ 2026-09-01', '2026-09-05'),
    '- [ ] file taxes ⏳ 2026-09-01 📅 2026-09-05',
  )
})

test('setDue replaces an existing 📅 in place — even one typed flush against the text', () => {
  assert.equal(
    setDue('- [ ] 搞一个ai meeting recorder📅 2026-09-05 ⏳ 2026-09-05', '2026-09-08'),
    '- [ ] 搞一个ai meeting recorder📅 2026-09-08 ⏳ 2026-09-05',
  )
})

test('setDue inserts before a trailing block reference', () => {
  assert.equal(setDue('- [ ] call bank ^abc12', '2026-09-05'), '- [ ] call bank 📅 2026-09-05 ^abc12')
})

test('clearDue is the inverse of setDue and keeps ⏳ and block refs', () => {
  const line = '- [ ] call bank ⏳ 2026-09-01 ^abc12'
  assert.equal(clearDue(setDue(line, '2026-09-05')), line)
  assert.equal(clearDue(line), line)
})
