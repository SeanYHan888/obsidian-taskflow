/**
 * Onboarding as a pure function (#6): environment facts in, message keys
 * out. The composition root gathers the facts on every refresh (never once
 * at load — a dependency enabled later must be noticed), the UI renders the
 * keys as copy. Core never touches Obsidian.
 */

export type SetupFacts = {
  tasksPluginAvailable: boolean
  /** The core Daily Notes plugin resolves to a folder + format. */
  dailyNotesConfigured: boolean
  projectsFolderExists: boolean
  /** A template path is set (blank means the built-in scaffold, which is fine). */
  templateConfigured: boolean
  templateExists: boolean
}

export type SetupMessageKey =
  /** Blocking: the panel has no task source at all. */
  | 'tasks-plugin-missing'
  /** Capture and send-back need the core Daily Notes plugin. */
  | 'daily-notes-unconfigured'
  /** The Backlogs section teaches the project workflow instead of sitting blank. */
  | 'projects-folder-missing'
  /** A configured template that doesn't exist falls back to the scaffold — say so. */
  | 'template-missing'

export const setupState = (facts: SetupFacts): SetupMessageKey[] => {
  const keys: SetupMessageKey[] = []
  if (!facts.tasksPluginAvailable) keys.push('tasks-plugin-missing')
  if (!facts.dailyNotesConfigured) keys.push('daily-notes-unconfigured')
  if (!facts.projectsFolderExists) keys.push('projects-folder-missing')
  if (facts.templateConfigured && !facts.templateExists) keys.push('template-missing')
  return keys
}
