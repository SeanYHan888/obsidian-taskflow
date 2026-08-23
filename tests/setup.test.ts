import {assert, test} from 'vitest'

import {setupState} from '../src/core/setup'

import type {SetupFacts} from '../src/core/setup'

const ALL_GOOD: SetupFacts = {
  tasksPluginAvailable: true,
  dailyNotesConfigured: true,
  projectsFolderExists: true,
  templateConfigured: false,
  templateExists: false,
}

test('a fully configured vault has nothing to say', () => {
  assert.deepEqual(setupState(ALL_GOOD), [])
})

test('every missing environment piece produces its own message key', () => {
  assert.deepEqual(
    setupState({
      tasksPluginAvailable: false,
      dailyNotesConfigured: false,
      projectsFolderExists: false,
      templateConfigured: true,
      templateExists: false,
    }),
    [
      'tasks-plugin-missing',
      'daily-notes-unconfigured',
      'projects-folder-missing',
      'template-missing',
    ],
  )
})

test('a blank template path is the built-in scaffold, not a missing template', () => {
  assert.deepEqual(
    setupState({...ALL_GOOD, templateConfigured: false, templateExists: false}),
    [],
  )
  assert.deepEqual(
    setupState({...ALL_GOOD, templateConfigured: true, templateExists: true}),
    [],
  )
  assert.deepEqual(
    setupState({...ALL_GOOD, templateConfigured: true, templateExists: false}),
    ['template-missing'],
  )
})

test('a vault with no projects folder still runs the daily sections', () => {
  const keys = setupState({...ALL_GOOD, projectsFolderExists: false})
  assert.deepEqual(keys, ['projects-folder-missing'])
  assert.notInclude(keys, 'tasks-plugin-missing')
})
