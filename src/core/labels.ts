/**
 * The one naming rule for a task's source: the note's basename, extension
 * dropped. Machine-managed notes get no special label — the note's own name
 * is the honest one (a vendor label lived here once and diverged from the
 * row fallback).
 */
export const sourceLabel = (filePath: string): string =>
  (filePath.split('/').pop() ?? '').replace(/\.md$/, '')

/** Notice and journal-label grammar: "1 task", "3 tasks". */
export const plural = (n: number): string => `${n} task${n === 1 ? '' : 's'}`

export type ProjectDateEdit = {field: 'start' | 'deadline'; date: string | null}

/**
 * The notice for a project date edit (#23): what was written, and — when
 * the start now sits past the deadline — the contradiction, named with both
 * dates. Warn, never block: the write has already happened by the time this
 * is read. The same day is a one-day project, not a contradiction.
 */
export const projectDateNotice = (
  project: {name: string; start: string | null; deadline: string | null},
  edit: ProjectDateEdit,
): string => {
  const base =
    edit.date == null
      ? `Taskflow: ${project.name} ${edit.field} cleared`
      : `Taskflow: ${project.name} ${edit.field} → ${edit.date}`
  const start = edit.field === 'start' ? edit.date : project.start
  const deadline = edit.field === 'deadline' ? edit.date : project.deadline
  if (edit.date == null || start == null || deadline == null || start <= deadline) return base
  const day = (iso: string) => iso.slice(5)
  return edit.field === 'start'
    ? `${base} — start ${day(start)} is after deadline ${day(deadline)}`
    : `${base} — deadline ${day(deadline)} is before start ${day(start)}`
}

/**
 * The journal label for a task date edit — the same word the menu item
 * used (CONTEXT.md: Menu order), so notice and undo link speak as the menu
 * did: "start → 2026-09-15 on 3 tasks", "due cleared on 1 task".
 */
export const dateEditLabel = (
  field: 'start' | 'due',
  count: number,
  date: string | null,
): string =>
  date == null ? `${field} cleared on ${plural(count)}` : `${field} → ${date} on ${plural(count)}`
