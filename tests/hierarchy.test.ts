import {assert, test} from 'vitest'

import {
  buildTaskTree,
  collectDescendantLineNumbers,
  countTaskTree,
  flattenTaskTree,
  locationKey,
} from '../src/core/hierarchy'

type TestTodo = {
  filePath: string
  line: number
  parentLine?: number
  children: TestTodo[]
}

const todo = (
  line: number,
  parentLine?: number,
  filePath = 'project.md',
): TestTodo => ({filePath, line, parentLine, children: []})

test('buildTaskTree preserves parent, child, and grandchild hierarchy', () => {
  const parent = todo(1)
  const child = todo(2, 1)
  const grandchild = todo(3, 2)
  const sibling = todo(4)

  const roots = buildTaskTree([parent, child, grandchild, sibling])

  assert.deepEqual(roots, [parent, sibling])
  assert.deepEqual(parent.children, [child])
  assert.deepEqual(child.children, [grandchild])
  assert.equal(countTaskTree(roots), 4)
})

test('buildTaskTree promotes a task when its parent is filtered out', () => {
  const visibleChild = todo(2, 1)

  assert.deepEqual(buildTaskTree([visibleChild]), [visibleChild])
})

test('buildTaskTree never attaches a task to a parent in another file', () => {
  const firstFileParent = todo(1, undefined, 'first.md')
  const secondFileChild = todo(2, 1, 'second.md')

  assert.deepEqual(buildTaskTree([firstFileParent, secondFileChild]), [
    firstFileParent,
    secondFileChild,
  ])
})

test('collectDescendantLineNumbers follows nested list-item relationships', () => {
  const descendants = collectDescendantLineNumbers(
    [
      {line: 10, parent: -1},
      {line: 11, parent: 10},
      {line: 12, parent: 11},
      {line: 13, parent: 10},
      {line: 14, parent: -1},
      {line: 15, parent: 14},
    ],
    10,
  )

  assert.deepEqual(
    [...descendants].sort((a, b) => a - b),
    [10, 11, 12, 13],
  )
})

test('flattenTaskTree lists roots and descendants depth-first', () => {
  const child = {filePath: 'a.md', line: 11, children: []}
  const root = {filePath: 'a.md', line: 10, children: [child]}
  const sibling = {filePath: 'a.md', line: 20, children: []}
  assert.deepEqual(
    flattenTaskTree([root, sibling]).map(item => item.line),
    [10, 11, 20],
  )
})

test('locationKey is the file path and line, colon-joined', () => {
  assert.equal(locationKey('Projects/Active/a.md', 12), 'Projects/Active/a.md:12')
})
