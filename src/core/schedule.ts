const SCHEDULED = /⏳\s*\d{4}-\d{2}-\d{2}/
const TRAILING_BLOCK_REF = /\s+\^[A-Za-z0-9-]+$/
const OPEN_CHECKBOX = /^(\s*[-*+]\s+\[) (\])/

export type QuickDate = 'today' | 'tomorrow' | 'weekend'

/**
 * Stamps ⏳ (the day the user plans to work on it) onto a task line.
 * Replaces an existing ⏳ date in place; otherwise appends, staying ahead of a
 * trailing block reference. Everything else on the line — indentation, tags,
 * 📅 due dates — is untouched: due dates are never auto-edited.
 */
export const setScheduled = (line: string, date: string): string => {
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

const addDays = (iso: string, days: number): string => {
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
export const resolveQuickDate = (kind: QuickDate, today: string): string => {
  if (kind === 'today') return today
  if (kind === 'tomorrow') return addDays(today, 1)
  const dayOfWeek = new Date(`${today}T00:00:00`).getDay()
  if (dayOfWeek === 6 || dayOfWeek === 0) return today
  return addDays(today, 6 - dayOfWeek)
}
