const SCHEDULED = /⏳\s*\d{4}-\d{2}-\d{2}/
const DUE = /📅\s*\d{4}-\d{2}-\d{2}/
const TRAILING_BLOCK_REF = /\s+\^[A-Za-z0-9-]+$/
const OPEN_CHECKBOX = /^(\s*[-*+]\s+\[) (\])/

export type QuickDate = 'today' | 'tomorrow' | 'weekend'

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
  if (dayOfWeek === 6 || dayOfWeek === 0) return today
  return addDays(today, 6 - dayOfWeek)
}
