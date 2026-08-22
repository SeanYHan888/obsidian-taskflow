import {assert, test} from 'vitest'

import {dropIntent} from '../src/core/drop'

import type {DropConfig} from '../src/core/drop'

const CONFIG: DropConfig = {
  appleSyncPath: 'Indexes/System/Apple Sync.md',
  projectsFolder: 'Projects/Active',
  today: '2026-08-22',
}

const dailyTask = (overrides: {scheduled?: string | null; due?: string | null} = {}) => ({
  filePath: 'Daily Notes/2026/08/08-22, Sat.md',
  scheduled: null,
  due: null,
  ...overrides,
})

const projectTask = () => ({
  filePath: 'Projects/Active/colm-paper.md',
  scheduled: null,
  due: null,
})

test('dropping on To-do means stamp ⏳ today', () => {
  assert.deepEqual(
    dropIntent(dailyTask(), {kind: 'section', key: 'today'}, CONFIG),
    {kind: 'schedule-today'},
  )
})

test('a task already dated today has nothing to gain from the To-do drop', () => {
  assert.deepEqual(
    dropIntent(dailyTask({scheduled: '2026-08-22'}), {kind: 'section', key: 'today'}, CONFIG),
    {kind: 'none'},
  )
  assert.deepEqual(
    dropIntent(dailyTask({due: '2026-08-22'}), {kind: 'section', key: 'today'}, CONFIG),
    {kind: 'none'},
  )
})

test('dropping on a project header means move to that project', () => {
  assert.deepEqual(
    dropIntent(dailyTask(), {kind: 'project', path: 'Projects/Active/colm-paper.md'}, CONFIG),
    {kind: 'move-to-project', path: 'Projects/Active/colm-paper.md'},
  )
})

test('dropping a task on its own project does nothing', () => {
  assert.deepEqual(
    dropIntent(projectTask(), {kind: 'project', path: 'Projects/Active/colm-paper.md'}, CONFIG),
    {kind: 'none'},
  )
})

test('the merged To-do section leaves the inbox key with no drop meaning', () => {
  assert.deepEqual(
    dropIntent(dailyTask({scheduled: '2026-08-25'}), {kind: 'section', key: 'inbox'}, CONFIG),
    {kind: 'none'},
  )
  assert.deepEqual(
    dropIntent(projectTask(), {kind: 'section', key: 'inbox'}, CONFIG),
    {kind: 'none'},
  )
})

test('dropping on Upcoming asks for a date rather than guessing one', () => {
  assert.deepEqual(
    dropIntent(dailyTask(), {kind: 'section', key: 'upcoming'}, CONFIG),
    {kind: 'ask-date'},
  )
})

test('slipped and the projects section itself are not targets', () => {
  assert.deepEqual(
    dropIntent(dailyTask(), {kind: 'section', key: 'slipped'}, CONFIG),
    {kind: 'none'},
  )
  assert.deepEqual(
    dropIntent(dailyTask(), {kind: 'section', key: 'projects'}, CONFIG),
    {kind: 'none'},
  )
})

test('backlog tasks accept the time targets like any other row', () => {
  assert.deepEqual(dropIntent(projectTask(), {kind: 'section', key: 'today'}, CONFIG), {
    kind: 'schedule-today',
  })
  assert.deepEqual(dropIntent(projectTask(), {kind: 'section', key: 'upcoming'}, CONFIG), {
    kind: 'ask-date',
  })
})

test('apple sync tasks accept no drop at all', () => {
  const appleTask = {filePath: CONFIG.appleSyncPath, scheduled: null, due: '2026-08-25'}
  assert.deepEqual(dropIntent(appleTask, {kind: 'section', key: 'today'}, CONFIG), {
    kind: 'none',
  })
  assert.deepEqual(
    dropIntent(appleTask, {kind: 'project', path: 'Projects/Active/colm-paper.md'}, CONFIG),
    {kind: 'none'},
  )
})
