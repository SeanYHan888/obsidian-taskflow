export type HierarchyItem = {
  filePath: string
  line: number
  parentLine?: number
  children: HierarchyItem[]
}

export type ListItemRelation = {
  line: number
  parent: number
}

/**
 * Reconstructs task trees from Obsidian's list-item parent line metadata.
 * A task whose parent is not in the supplied collection is promoted to a root.
 */
export const buildTaskTree = <T extends HierarchyItem>(items: T[]): T[] => {
  const itemsByLocation = new Map<string, T>()
  const roots: T[] = []

  for (const item of items) {
    item.children = []
    itemsByLocation.set(locationKey(item.filePath, item.line), item)
  }

  for (const item of items) {
    const parent =
      item.parentLine == null
        ? undefined
        : itemsByLocation.get(locationKey(item.filePath, item.parentLine))

    if (parent && parent !== item) parent.children.push(item)
    else roots.push(item)
  }

  return roots
}

/** Returns the root list item and every nested descendant list item. */
export const collectDescendantLineNumbers = (
  items: readonly ListItemRelation[],
  rootLine: number,
): Set<number> => {
  const childrenByParent = new Map<number, number[]>()
  for (const item of items) {
    const children = childrenByParent.get(item.parent) ?? []
    children.push(item.line)
    childrenByParent.set(item.parent, children)
  }

  const descendants = new Set<number>([rootLine])
  const pending = [rootLine]
  while (pending.length > 0) {
    const parent = pending.pop()!
    for (const child of childrenByParent.get(parent) ?? []) {
      if (descendants.has(child)) continue
      descendants.add(child)
      pending.push(child)
    }
  }

  return descendants
}

export const countTaskTree = (items: readonly HierarchyItem[]): number =>
  items.reduce((count, item) => count + 1 + countTaskTree(item.children), 0)

export const locationKey = (filePath: string, line: number) => `${filePath}:${line}`

/** Roots and every nested descendant, depth-first. */
export const flattenTaskTree = <T extends HierarchyItem>(items: readonly T[]): T[] =>
  items.flatMap(item => [item, ...flattenTaskTree(item.children as T[])])

const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s/

/**
 * Derives list-item parent relations from raw lines by indentation — the same
 * shape the metadata cache provides, but computed from the exact content about
 * to be edited, so it can never lag the file. Blank lines keep the current
 * list open; any other non-item line closes it.
 */
export const relationsFromLines = (lines: string[]): ListItemRelation[] => {
  const relations: ListItemRelation[] = []
  const stack: {line: number; indent: number}[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(LIST_ITEM)
    if (!match) {
      if (lines[i].trim() !== '') stack.length = 0
      continue
    }
    const indent = match[1].length
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
    relations.push({line: i, parent: stack.length > 0 ? stack[stack.length - 1].line : -1})
    stack.push({line: i, indent})
  }
  return relations
}
