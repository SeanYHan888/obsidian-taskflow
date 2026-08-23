import {countTaskTree, flattenTaskTree, locationKey} from './hierarchy'

import type {Sections, TaskflowTask} from './types'

/**
 * Queries over a classified Sections projection — the questions the panel
 * asks after classifySections has answered "what goes where". All pure, all
 * testable through the same fixtures the classify suite already builds.
 */

/** Every task a selection can span: To-do, its inbox tail, and the backlogs. */
export const selectionSpan = (sections: Sections | null): TaskflowTask[] =>
  sections
    ? [
        ...flattenTaskTree(sections.today),
        ...flattenTaskTree(sections.inbox),
        ...sections.projects.flatMap(g => flattenTaskTree(g.tasks)),
      ]
    : []

/**
 * The selected tasks, one per location. A task dated today renders in both
 * To-do and its project group; deduping by location key is the invariant
 * that a bulk action never edits the same line twice.
 */
export const selectionTasks = (
  sections: Sections | null,
  selectedKeys: ReadonlySet<string>,
): TaskflowTask[] => {
  const byKey = new Map<string, TaskflowTask>()
  for (const t of selectionSpan(sections)) {
    const key = locationKey(t.filePath, t.line)
    if (selectedKeys.has(key) && !byKey.has(key)) byKey.set(key, t)
  }
  return [...byKey.values()]
}

/** Keeps only keys whose line still exists in the fresh projection. */
export const pruneSelection = (
  sections: Sections | null,
  selectedKeys: ReadonlySet<string>,
): Set<string> => {
  const valid = new Set(selectionSpan(sections).map(t => locationKey(t.filePath, t.line)))
  return new Set([...selectedKeys].filter(k => valid.has(k)))
}

export type SectionCounts = {
  today: number
  slipped: number
  upcoming: number
  inbox: number
  projects: number
}

export const sectionCounts = (sections: Sections | null): SectionCounts => ({
  today: sections ? countTaskTree(sections.today) : 0,
  slipped: sections ? countTaskTree(sections.slipped) : 0,
  upcoming: sections ? countTaskTree(sections.upcoming) : 0,
  inbox: sections ? countTaskTree(sections.inbox) : 0,
  projects: sections
    ? sections.projects.reduce((sum, g) => sum + countTaskTree(g.tasks), 0)
    : 0,
})

export type WipBadge = {
  label: string
  /** Exceeding the limit warns (red), never blocks. */
  danger: boolean
}

export const wipBadge = (sections: Sections | null, wipLimit: number): WipBadge | null =>
  sections && sections.wipNowCount > 0
    ? {
        label: `now ${sections.wipNowCount}/${wipLimit}`,
        danger: sections.wipNowCount > wipLimit,
      }
    : null

export type RetirePlan = {
  openCount: number
  /** Open tasks leave the panel with the note, so they confirm first. */
  needsConfirm: boolean
}

export const retirePlan = (sections: Sections | null, projectPath: string): RetirePlan => {
  const group = sections?.projects.find(g => g.project.path === projectPath)
  const openCount = group ? flattenTaskTree(group.tasks).length : 0
  return {openCount, needsConfirm: openCount > 0}
}
