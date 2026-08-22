/**
 * The undo journal (ADR-0001 upheld): a session log of line edits, never a
 * store of tasks. Each panel action becomes one entry; undoing an entry
 * verifies every line still reads what the action left before restoring it —
 * the same skip-and-report discipline forward edits use.
 */

export type LineRecord =
  /** A line changed in place; undo restores `before` if it still reads `after`. */
  | {kind: 'replace'; file: string; line: number; before: string; after: string}
  /** A line the action inserted (post-insert index); undo removes it if it still reads `text`. */
  | {kind: 'insert'; file: string; line: number; text: string}
  /** A line the action removed (pre-removal index); undo re-inserts it. */
  | {kind: 'remove'; file: string; line: number; text: string}

export type JournalEntry = {
  /** Glossary-phrased summary shown in the undo notice, e.g. "moved 3 tasks to colm-paper". */
  label: string
  records: LineRecord[]
}

export type UndoFileResult = {lines: string[]; reverted: number; stale: number}

/**
 * Applies the inverse of one entry's records for a single file to its lines.
 */
export const undoRecordsInFile = (
  lines: string[],
  records: LineRecord[],
): UndoFileResult => {
  const result = [...lines]
  let reverted = 0
  let stale = 0

  for (const record of records) {
    if (record.kind !== 'replace') continue
    if (result[record.line] === record.after) {
      result[record.line] = record.before
      reverted++
    } else {
      stale++
    }
  }

  // Inserted lines are removed highest-first so earlier indices stay valid.
  const inserts = records
    .filter(r => r.kind === 'insert')
    .sort((a, b) => b.line - a.line)
  for (const record of inserts) {
    if (result[record.line] === record.text) {
      result.splice(record.line, 1)
      reverted++
    } else {
      stale++
    }
  }

  // Removed lines are re-inserted at ascending pre-removal indices, which
  // reconstructs the original layout exactly. Restoring content is the
  // non-destructive direction, so the only gate is against duplication: a
  // line the note already contains again (restored by hand since) is
  // skipped as stale rather than doubled. A shrunken note clamps the index.
  const removes = records
    .filter(r => r.kind === 'remove')
    .sort((a, b) => a.line - b.line)
  for (const record of removes) {
    if (result.includes(record.text)) {
      stale++
      continue
    }
    result.splice(Math.min(record.line, result.length), 0, record.text)
    reverted++
  }

  return {lines: result, reverted, stale}
}
