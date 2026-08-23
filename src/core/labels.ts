/**
 * The one naming rule for a task's source: the note's basename, extension
 * dropped. Machine-managed notes get no special label — the note's own name
 * is the honest one (a vendor label lived here once and diverged from the
 * row fallback).
 */
export const sourceLabel = (filePath: string): string =>
  (filePath.split('/').pop() ?? '').replace(/\.md$/, '')
