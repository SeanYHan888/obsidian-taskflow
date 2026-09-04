import {assert, test} from 'vitest'

import {canPlace, compareProjects, moveWrites, organizeByStatus, placeWrites, topRank} from '../src/core/order'

import type {ProjectMeta} from '../src/core/types'

const meta = (name: string, overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  path: `Projects/Active/${name}.md`,
  name,
  status: 'next',
  deadline: null,
  order: null,
  ...overrides,
})

/** Applies writes and re-sorts — what the panel shows after the notes are written. */
const after = (projects: ProjectMeta[], writes: {path: string; order: number}[]) =>
  projects
    .map(p => ({...p, order: writes.find(w => w.path === p.path)?.order ?? p.order}))
    .sort((a, b) => compareProjects(a, b, 'hybrid'))
    .map(p => p.name)

test('topRank goes one below the lowest rank, and starts at zero', () => {
  assert.equal(topRank([meta('a'), meta('b')]), 0)
  assert.equal(topRank([meta('a', {order: 3}), meta('b', {order: -1})]), -2)
})

test('move to top is one write; at the top already it is none', () => {
  const list = [meta('a', {order: 1}), meta('b', {order: 2}), meta('c')]
  assert.deepEqual(moveWrites(list, 'Projects/Active/c.md', 'top'), [
    {path: 'Projects/Active/c.md', order: 0},
  ])
  assert.deepEqual(after(list, moveWrites(list, 'Projects/Active/c.md', 'top')), ['c', 'a', 'b'])
  assert.deepEqual(moveWrites(list, 'Projects/Active/a.md', 'top'), [])
})

test('up and down among ranked projects re-stamp only what the new sequence needs', () => {
  const list = [meta('a', {order: 1}), meta('b', {order: 2}), meta('c', {order: 3}), meta('d', {order: 4})]
  const up = moveWrites(list, 'Projects/Active/c.md', 'up')
  assert.deepEqual(after(list, up), ['a', 'c', 'b', 'd'])
  assert.isAtMost(up.length, 2)
  const down = moveWrites(list, 'Projects/Active/a.md', 'down')
  assert.deepEqual(after(list, down), ['b', 'a', 'c', 'd'])
  assert.deepEqual(moveWrites(list, 'Projects/Active/a.md', 'up'), [])
  assert.deepEqual(moveWrites(list, 'Projects/Active/d.md', 'down'), [])
})

test('an unranked neighbour gets a rank on demand, and only the notes involved are written', () => {
  // Display order: ranked prefix, then unranked under the pacing rules.
  const list = [meta('a', {order: 1}), meta('b'), meta('c'), meta('d')]
  const up = moveWrites(list, 'Projects/Active/c.md', 'up')
  assert.deepEqual(after(list, up), ['a', 'c', 'b', 'd'])
  assert.notInclude(up.map(w => w.path), 'Projects/Active/d.md')
  const down = moveWrites(list, 'Projects/Active/a.md', 'down')
  assert.deepEqual(after(list, down), ['b', 'a', 'c', 'd'])
})

test('move to bottom lands below the unranked tail, ranking the tail on the way', () => {
  const list = [meta('a', {order: 1}), meta('b', {order: 2}), meta('c'), meta('d')]
  const writes = moveWrites(list, 'Projects/Active/a.md', 'bottom')
  assert.deepEqual(after(list, writes), ['b', 'c', 'd', 'a'])
  assert.deepEqual(moveWrites(list, 'Projects/Active/d.md', 'bottom'), [])
})

test('a project not in the movable list moves nothing', () => {
  assert.deepEqual(moveWrites([meta('a')], 'Projects/Active/zzz.md', 'up'), [])
})

test('organize by status regroups now → next → later, keeping order inside each tier', () => {
  const list = [
    meta('later-first', {status: 'later', order: 1}),
    meta('now-second', {status: 'now', order: 2}),
    meta('next-third', {status: 'next', order: 3}),
    meta('now-unranked', {status: 'now'}),
    meta('later-unranked', {status: 'later'}),
  ]
  const writes = organizeByStatus(list, 'hybrid')
  assert.deepEqual(after(list, writes), [
    'now-second',
    'now-unranked',
    'next-third',
    'later-first',
    'later-unranked',
  ])
  // Ranks are 1..n and the act is idempotent.
  const organized = list.map(p => ({...p, order: writes.find(w => w.path === p.path)?.order ?? p.order}))
  assert.deepEqual([...organized.map(p => p.order)].sort((x, y) => x! - y!), [1, 2, 3, 4, 5])
  assert.deepEqual(organizeByStatus(organized, 'hybrid'), [])
})

test('organize writes nothing for projects already holding their new rank', () => {
  const list = [meta('a', {status: 'now', order: 1}), meta('b', {status: 'next'})]
  assert.deepEqual(organizeByStatus(list, 'hybrid'), [{path: 'Projects/Active/b.md', order: 2}])
})

test('a dropped header takes the target slot: before it dragging up, after it dragging down (#21)', () => {
  const list = [meta('a', {order: 1}), meta('b', {order: 2}), meta('c', {order: 3}), meta('d')]
  const P = (n: string) => `Projects/Active/${n}.md`
  assert.deepEqual(after(list, placeWrites(list, P('a'), P('c'))), ['b', 'c', 'a', 'd'])
  assert.deepEqual(after(list, placeWrites(list, P('d'), P('b'))), ['a', 'd', 'b', 'c'])
  // Landing first is the one-write top rank.
  assert.deepEqual(placeWrites(list, P('c'), P('a')), [{path: P('c'), order: 0}])
  assert.deepEqual(after(list, placeWrites(list, P('c'), P('a'))), ['c', 'a', 'b', 'd'])
})

test('canPlace: both in the movable list and different; nothing else drops (#21)', () => {
  const list = [meta('a'), meta('b')]
  assert.isTrue(canPlace(list, 'Projects/Active/a.md', 'Projects/Active/b.md'))
  assert.isFalse(canPlace(list, 'Projects/Active/a.md', 'Projects/Active/a.md'))
  assert.isFalse(canPlace(list, 'Projects/Active/a.md', 'Projects/Active/arrived.md'))
  assert.deepEqual(placeWrites(list, 'Projects/Active/a.md', 'Projects/Active/a.md'), [])
})
