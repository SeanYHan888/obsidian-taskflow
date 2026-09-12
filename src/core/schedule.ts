const SCHEDULED = /⏳\s*\d{4}-\d{2}-\d{2}/
const DUE = /📅\s*\d{4}-\d{2}-\d{2}/
const TRAILING_BLOCK_REF = /\s+\^[A-Za-z0-9-]+$/
const OPEN_CHECKBOX = /^(\s*[-*+]\s+\[) (\])/

/** The Start group's one-tap targets, resolved from today (CONTEXT.md: Quick date). */
export type QuickDate = 'today' | 'tomorrow' | 'weekend' | 'next-week'
/** The relative pair: a quick date whose target moves with the task's own start. */
export type RelativeDate = 'plus-day' | 'plus-week'

/** The ISO date of the line's 📅 field, or null when it has none. */
const dueDateOf = (line: string): string | null =>
  line.match(/📅\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null

/**
 * Stamps ⏳ (the day the user plans to work on it) onto a task line.
 * Replaces an existing ⏳ date in place; otherwise appends, staying ahead of a
 * trailing block reference. Everything else on the line — indentation, tags,
 * a live 📅 due date — is untouched: a deadline still ahead is never
 * auto-edited, and a plan set before it stands beside it.
 *
 * A plan that lands on the deadline itself is not written (#18): the 📅 date
 * already puts the task in To-do that day, so a matching ⏳ would only show
 * the same date twice. Any ⏳ the line held is withdrawn instead.
 *
 * A deadline already behind `today` is spent. Re-dating such a task moves
 * its one date — the 📅 takes the new date and any ⏳ is withdrawn — rather
 * than stacking a plan beside a stale deadline, which would show two dates
 * and keep the task in Overdue & slipped for good. `today` is injected:
 * core never reads the clock.
 */
export const setScheduled = (line: string, date: string, today: string): string => {
  const due = dueDateOf(line)
  if (due != null && due < today) return clearScheduled(setDue(line, date))
  if (due === date) return clearScheduled(line)
  if (SCHEDULED.test(line)) return line.replace(SCHEDULED, `⏳ ${date}`)
  const blockRef = line.match(TRAILING_BLOCK_REF)
  if (blockRef) {
    return line.slice(0, blockRef.index) + ` ⏳ ${date}` + blockRef[0]
  }
  return `${line} ⏳ ${date}`
}

/** Flips an open checkbox to cancelled (`[-]`); anything else is left alone. */
export const cancelLine = (line: string): string =>
  line.replace(OPEN_CHECKBOX, '$1-$2')

/**
 * Removes the ⏳ scheduled date — the inverse of setScheduled. 📅 due dates
 * are left alone: only the plan is withdrawn, never the deadline.
 */
export const clearScheduled = (line: string): string =>
  line.replace(/\s*⏳\s*\d{4}-\d{2}-\d{2}/, '')

/**
 * Stamps 📅 (a real external deadline) onto a task line — the due chip's own
 * writer (#18). Same placement rules as setScheduled: replace in place, else
 * append ahead of a trailing block reference. ⏳ is untouched: the plan and
 * the deadline are two fields, each edited only by its own chip.
 */
export const setDue = (line: string, date: string): string => {
  if (DUE.test(line)) return line.replace(DUE, `📅 ${date}`)
  const blockRef = line.match(TRAILING_BLOCK_REF)
  if (blockRef) {
    return line.slice(0, blockRef.index) + ` 📅 ${date}` + blockRef[0]
  }
  return `${line} 📅 ${date}`
}

/** Removes the 📅 due date — the inverse of setDue. ⏳ is left alone. */
export const clearDue = (line: string): string =>
  line.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/, '')

export const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Resolves a quick-date chip to an ISO date. `today` is injected — core never
 * reads the clock. Weekend means the coming Saturday, or today when today is
 * already the weekend.
 */
/** One chip vocabulary panel-wide: 'today', or MM-DD for any other date. */
export const chipLabel = (date: string, today: string): string =>
  date === today ? 'today' : date.slice(5)

export const resolveQuickDate = (kind: QuickDate, today: string): string => {
  if (kind === 'today') return today
  if (kind === 'tomorrow') return addDays(today, 1)
  const dayOfWeek = new Date(`${today}T00:00:00`).getDay()
  // Next week is the coming Monday — on a Monday, a full week away.
  if (kind === 'next-week') return addDays(today, (8 - dayOfWeek) % 7 || 7)
  if (dayOfWeek === 6 || dayOfWeek === 0) return today
  return addDays(today, 6 - dayOfWeek)
}

/**
 * Where a relative quick date counts from (CONTEXT.md: Quick date): the
 * task's start while it is still ahead, today once it has arrived or
 * slipped. A spent deadline re-dates by the same rules as a start (see
 * setScheduled), so it can be postponed too; a live deadline alone is a
 * fact, never nudged, and an undated task has nothing to move — null.
 */
export const postponeAnchor = (
  task: {scheduled: string | null; due: string | null},
  today: string,
): string | null => {
  if (task.scheduled != null) return task.scheduled > today ? task.scheduled : today
  if (task.due != null && task.due < today) return today
  return null
}

export const resolveRelativeDate = (kind: RelativeDate, anchor: string): string =>
  addDays(anchor, kind === 'plus-day' ? 1 : 7)

export type RowChip = {field: 'start' | 'due'; date: string; past: boolean}

/**
 * The chip rule's one chip (CONTEXT.md): the date that matters next, the
 * way a project header shows its start while unstarted and its deadline
 * after. An arrived due first — a debt on arrival (`<=`) beats any plan —
 * then the start while it is ahead (a start on the due day is the due),
 * then the due still ahead, else the start, slipped once its day is over (`<`).
 */
export const rowChip = (
  task: {scheduled: string | null; due: string | null},
  today: string,
): RowChip | null => {
  const {scheduled, due} = task
  // A debt beats a plan: an arrived due shows whatever the start says.
  if (due != null && due <= today) return {field: 'due', date: due, past: true}
  if (scheduled != null && scheduled > today && scheduled !== due) {
    return {field: 'start', date: scheduled, past: false}
  }
  if (due != null) return {field: 'due', date: due, past: due <= today}
  if (scheduled != null) return {field: 'start', date: scheduled, past: scheduled < today}
  return null
}

/** Where a task line's words end: the first Tasks field emoji, or a trailing block reference. */
const FIELD_TAIL = /\s*(?:[➕🛫⏳⌛📅✅❌🔁🔺⏫🔼🔽⏬🆔⛔]|\^[A-Za-z0-9-]+$)/u
const CHECKBOX_PREFIX = /^(\s*[-*+]\s+\[.\]\s*)/

/** Splits a checkbox line into its prefix, its words, and the field tail — null for a non-task line. */
const splitTaskLine = (line: string): {prefix: string; words: string; tail: string} | null => {
  const prefix = line.match(CHECKBOX_PREFIX)?.[1]
  if (prefix == null) return null
  const rest = line.slice(prefix.length)
  const at = rest.search(FIELD_TAIL)
  return at < 0
    ? {prefix, words: rest.trimEnd(), tail: ''}
    : {prefix, words: rest.slice(0, at).trimEnd(), tail: rest.slice(at).trimStart()}
}

/**
 * The words a task line holds, as written: everything between the checkbox
 * and the first field (or block reference), tags included. This — not the
 * task source's description, which strips fields from wherever they sit and
 * may drop a global filter tag — is what Edit text shows and replaces, so
 * what the user sees is exactly what is rewritten.
 */
export const taskWords = (line: string): string => splitTaskLine(line)?.words ?? ''

/**
 * Edit text: swaps the words and nothing else — checkbox, every field, and
 * the block reference stay, one space apart. A non-task line is left alone.
 */
export const withTaskWords = (line: string, words: string): string => {
  const parts = splitTaskLine(line)
  if (parts == null) return line
  return parts.prefix + words + (parts.tail ? ` ${parts.tail}` : '')
}
