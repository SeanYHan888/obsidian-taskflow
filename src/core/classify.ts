import {buildTaskTree} from './hierarchy'

import type {ClassifyConfig, ProjectMeta, Sections, TaskflowTask} from './types'

export const inFolder = (filePath: string, folder: string): boolean =>
  filePath.startsWith(folder.replace(/\/$/, '') + '/')

const normalizeHeading = (heading: string) =>
  heading.replace(/^#+\s*/, '').trim().toLowerCase()

const isEventsHeading = (heading: string) =>
  normalizeHeading(heading).replace(/:$/, '') === 'events'

/**
 * A task can appear in more than one section (Today and its project group),
 * so each section trees its own copies — trees never share mutable children.
 */
const toTree = (tasks: TaskflowTask[]): TaskflowTask[] =>
  buildTaskTree(tasks.map(t => ({...t, children: []})))

export const classifySections = (
  tasks: TaskflowTask[],
  projects: ProjectMeta[],
  config: ClassifyConfig,
): Sections => {
  const isCalendarBlock = (t: TaskflowTask) =>
    t.filePath === config.appleSyncPath && t.scheduled != null

  const isEventsBlock = (t: TaskflowTask) =>
    inFolder(t.filePath, config.dailyNotesFolder) &&
    t.heading != null &&
    isEventsHeading(t.heading)

  const visible = tasks.filter(
    t =>
      t.open &&
      t.description.trim() !== '' &&
      !isCalendarBlock(t) &&
      !isEventsBlock(t),
  )

  const isToday = (t: TaskflowTask) =>
    t.scheduled === config.today || t.due === config.today

  const today = visible.filter(isToday)

  const inboxHeading = normalizeHeading(config.inboxHeading)
  const inbox = visible
    .filter(
      t =>
        t.scheduled == null &&
        t.due == null &&
        inFolder(t.filePath, config.dailyNotesFolder) &&
        t.heading != null &&
        normalizeHeading(t.heading) === inboxHeading,
    )
    .sort((a, b) => b.filePath.localeCompare(a.filePath) || a.line - b.line)

  const slippedDate = (t: TaskflowTask) => t.due ?? t.scheduled ?? ''
  const slipped = visible
    .filter(
      t =>
        !isToday(t) &&
        ((t.due != null && t.due < config.today) ||
          (t.scheduled != null && t.scheduled < config.today)),
    )
    .sort((a, b) => slippedDate(a).localeCompare(slippedDate(b)))

  const statusRank = (status: ProjectMeta['status']) =>
    status === 'now' ? 0 : status === 'next' ? 1 : status === 'later' ? 2 : 3

  const projectGroups = projects
    .map(project => ({
      project,
      tasks: toTree(
        visible
          .filter(t => t.filePath === project.path)
          .sort((a, b) => a.line - b.line),
      ),
    }))
    .filter(group => group.tasks.length > 0)
    .sort(
      (a, b) =>
        statusRank(a.project.status) - statusRank(b.project.status) ||
        a.project.name.localeCompare(b.project.name),
    )

  return {
    today: toTree(today),
    slipped: toTree(slipped),
    inbox: toTree(inbox),
    projects: projectGroups,
    wipNowCount: projects.filter(p => p.status === 'now').length,
  }
}
