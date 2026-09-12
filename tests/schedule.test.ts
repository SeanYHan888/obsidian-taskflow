import {assert, test} from 'vitest'

import {
  cancelLine,
  chipLabel,
  clearDue,
  clearScheduled,
  postponeAnchor,
  replaceDescription,
  resolveQuickDate,
  resolveRelativeDate,
  rowChip,
  setDue,
  setScheduled,
} from '../src/core/schedule'

// The injected clock: every 📅 in these lines is still ahead of it unless a
// test says otherwise.
const TODAY = '2026-08-21'

test('setScheduled appends ⏳ to an undated line, touching nothing else', () => {
  assert.equal(
    setScheduled('  - [ ] read mem-agent paper #research', '2026-08-22', TODAY),
    '  - [ ] read mem-agent paper #research ⏳ 2026-08-22',
  )
})

test('setScheduled replaces an existing ⏳ date in place', () => {
  assert.equal(
    setScheduled('- [ ] follow up with advisor ⏳ 2026-08-19', '2026-08-21', TODAY),
    '- [ ] follow up with advisor ⏳ 2026-08-21',
  )
})

test('setScheduled never touches a live 📅 due date', () => {
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-25', '2026-08-21', TODAY),
    '- [ ] submit form 📅 2026-08-25 ⏳ 2026-08-21',
  )
  // Due today is live, not spent: a plan for tomorrow stands beside it.
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-21', '2026-08-22', TODAY),
    '- [ ] submit form 📅 2026-08-21 ⏳ 2026-08-22',
  )
})

test('setScheduled on a spent 📅 moves the deadline — one date, not a plan beside a stale one', () => {
  // The bug: re-dating an overdue task stacked ⏳ next to the past 📅, so the
  // row showed two chips and stayed in Overdue & slipped.
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-15', '2026-08-22', TODAY),
    '- [ ] submit form 📅 2026-08-22',
  )
  // Quick "today" on an overdue task: same move, onto today.
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-15', TODAY, TODAY),
    '- [ ] submit form 📅 2026-08-21',
  )
  // A line the bug already doubled collapses to the new date.
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-15 ⏳ 2026-08-20', '2026-08-22', TODAY),
    '- [ ] submit form 📅 2026-08-22',
  )
  // Block refs and flush-typed emoji survive the move.
  assert.equal(
    setScheduled('- [ ] 搞一个ai meeting recorder📅 2026-08-15 ⏳ 2026-08-16 ^abc12', '2026-08-22', TODAY),
    '- [ ] 搞一个ai meeting recorder📅 2026-08-22 ^abc12',
  )
})

test('setScheduled onto the due day writes no ⏳ — one date, not the same date twice (#18)', () => {
  assert.equal(
    setScheduled('- [ ] submit form 📅 2026-08-25', '2026-08-25', TODAY),
    '- [ ] submit form 📅 2026-08-25',
  )
  // A plan moved onto the deadline is withdrawn, not duplicated.
  assert.equal(
    setScheduled('- [ ] 搞一个ai meeting recorder📅 2026-09-05 ⏳ 2026-09-01', '2026-09-05', TODAY),
    '- [ ] 搞一个ai meeting recorder📅 2026-09-05',
  )
  // A line already doubled collapses to its deadline.
  assert.equal(
    setScheduled('- [ ] 搞一个ai meeting recorder📅 2026-09-05 ⏳ 2026-09-05', '2026-09-05', TODAY),
    '- [ ] 搞一个ai meeting recorder📅 2026-09-05',
  )
})

test('setScheduled inserts before a trailing block reference', () => {
  assert.equal(
    setScheduled('- [ ] linked task ^abc123', '2026-08-22', TODAY),
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
  assert.equal(clearScheduled(setScheduled(line, '2026-08-22', TODAY)), line)
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

test('resolveQuickDate next-week means the coming Monday — a full week away on a Monday', () => {
  assert.equal(resolveQuickDate('next-week', '2026-09-12'), '2026-09-14') // Sat → Mon
  assert.equal(resolveQuickDate('next-week', '2026-09-13'), '2026-09-14') // Sun → Mon
  assert.equal(resolveQuickDate('next-week', '2026-09-14'), '2026-09-21') // Mon → next Mon
  assert.equal(resolveQuickDate('next-week', '2026-09-16'), '2026-09-21') // Wed → Mon
})

test('postponeAnchor: the start while it is ahead, today once it has arrived or slipped, null with nothing to postpone', () => {
  const today = '2026-09-12'
  assert.equal(postponeAnchor({scheduled: '2026-09-20', due: null}, today), '2026-09-20')
  assert.equal(postponeAnchor({scheduled: '2026-09-12', due: null}, today), today)
  assert.equal(postponeAnchor({scheduled: '2026-09-01', due: null}, today), today)
  // A spent deadline re-dates by the same quick-date rules, so it can be postponed too.
  assert.equal(postponeAnchor({scheduled: null, due: '2026-09-01'}, today), today)
  // A live deadline alone is a fact, never nudged; an undated task has nothing to move.
  assert.isNull(postponeAnchor({scheduled: null, due: '2026-09-20'}, today))
  assert.isNull(postponeAnchor({scheduled: null, due: null}, today))
})

test('resolveRelativeDate adds a day or a week to the anchor', () => {
  assert.equal(resolveRelativeDate('plus-day', '2026-09-30'), '2026-10-01')
  assert.equal(resolveRelativeDate('plus-week', '2026-09-28'), '2026-10-05')
})

test('rowChip shows the date that matters next: the start while ahead, then the due, else the start', () => {
  const today = '2026-09-12'
  assert.deepEqual(rowChip({scheduled: '2026-09-20', due: '2026-09-30'}, today), {
    field: 'start',
    date: '2026-09-20',
    past: false,
  })
  // Started: the deadline is the date still ahead.
  assert.deepEqual(rowChip({scheduled: '2026-09-12', due: '2026-09-30'}, today), {
    field: 'due',
    date: '2026-09-30',
    past: false,
  })
  // Due is a debt on arrival (<=); a start slips only once the day is over (<).
  assert.deepEqual(rowChip({scheduled: null, due: '2026-09-12'}, today), {field: 'due', date: '2026-09-12', past: true})
  assert.deepEqual(rowChip({scheduled: '2026-09-12', due: null}, today), {field: 'start', date: '2026-09-12', past: false})
  assert.deepEqual(rowChip({scheduled: '2026-09-10', due: null}, today), {field: 'start', date: '2026-09-10', past: true})
  // A start on the due day is the due: one chip, the 📅 one.
  assert.deepEqual(rowChip({scheduled: '2026-09-20', due: '2026-09-20'}, today), {field: 'due', date: '2026-09-20', past: false})
  assert.isNull(rowChip({scheduled: null, due: null}, today))
})

test('replaceDescription rewrites the words and nothing else; an unmatched line is left alone', () => {
  assert.equal(
    replaceDescription('  - [ ] read the paper #research ⏳ 2026-09-20 📅 2026-09-30 ^ref1', 'read the paper #research', 'skim the paper #research'),
    '  - [ ] skim the paper #research ⏳ 2026-09-20 📅 2026-09-30 ^ref1',
  )
  assert.equal(replaceDescription('- [ ] something else', 'read the paper', 'skim'), '- [ ] something else')
  // Ambiguity is skipped, never guessed at.
  assert.equal(replaceDescription('- [ ] go go', 'go', 'stop'), '- [ ] go go')
})
