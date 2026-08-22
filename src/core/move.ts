import {collectDescendantLineNumbers} from './hierarchy'

import type {ListItemRelation} from './hierarchy'

/**
 * Move to project (CONTEXT.md): physically cutting task lines — each with its
 * subtask children — out of a note. Not a copy, not a link.
 *
 * Selected roots nested inside another selected root are folded into the
 * ancestor's block. Each block is dedented so its root sits at column zero,
 * with children keeping their indentation relative to the root.
 */
export const cutTaskBlocks = (
  lines: string[],
  rootLines: number[],
  listItems: ListItemRelation[],
): {remaining: string[]; blocks: string[][]} => {
  const descendantsByRoot = new Map<number, Set<number>>()
  for (const root of rootLines) {
    descendantsByRoot.set(root, collectDescendantLineNumbers(listItems, root))
  }

  const roots = [...rootLines]
    .sort((a, b) => a - b)
    .filter(root =>
      rootLines.every(other => other === root || !descendantsByRoot.get(other)?.has(root)),
    )

  const removed = new Set<number>()
  const blocks: string[][] = []
  for (const root of roots) {
    const blockLines = [...(descendantsByRoot.get(root) ?? [root])]
      .sort((a, b) => a - b)
      .filter(line => line < lines.length)
    blockLines.forEach(line => removed.add(line))

    const indent = lines[root].match(/^\s*/)?.[0] ?? ''
    blocks.push(
      blockLines.map(line =>
        lines[line].startsWith(indent) ? lines[line].slice(indent.length) : lines[line],
      ),
    )
  }

  return {
    remaining: lines.filter((_, index) => !removed.has(index)),
    blocks,
  }
}

const normalizeHeading = (heading: string) =>
  heading.replace(/^#+\s*/, '').trim().toLowerCase()

/**
 * Appends blocks under the move-target heading: after the section's last
 * non-blank line, or right after the heading when the section is empty. A
 * missing heading is created at the end of the note (level 2).
 */
export const insertUnderHeading = (
  lines: string[],
  heading: string,
  blocks: string[][],
): string[] => {
  const target = normalizeHeading(heading)
  const flat = blocks.flat()

  let headingIndex = -1
  let headingLevel = 0
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.*)$/)
    if (match && normalizeHeading(match[2]) === target) {
      headingIndex = i
      headingLevel = match[1].length
      break
    }
  }

  if (headingIndex === -1) {
    const explicitMarks = heading.trim().match(/^#{1,6}(?=\s)/)?.[0]
    const headingLine = `${explicitMarks ?? '##'} ${heading.replace(/^#+\s*/, '').trim()}`
    const result = [...lines]
    if (result.length > 0 && result[result.length - 1].trim() !== '') result.push('')
    result.push(headingLine, '', ...flat)
    return result
  }

  let sectionEnd = lines.length
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s/)
    if (match && match[1].length <= headingLevel) {
      sectionEnd = i
      break
    }
  }

  let insertAt = headingIndex + 1
  for (let i = sectionEnd - 1; i > headingIndex; i--) {
    if (lines[i].trim() !== '') {
      insertAt = i + 1
      break
    }
  }

  return [...lines.slice(0, insertAt), ...flat, ...lines.slice(insertAt)]
}
