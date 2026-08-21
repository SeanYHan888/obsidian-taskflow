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
