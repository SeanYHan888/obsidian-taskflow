import {buildTaskTree} from './hierarchy'
import {isCalendarBlock} from './machine-note'

import type {ClassifyConfig, ProjectMeta, Sections, TaskflowTask} from './types'

export const inFolder = (filePath: string, folder: string): boolean =>
  filePath.startsWith(folder.replace(/\/$/, '') + '/')

const normalizeHeading = (heading: string) =>
  heading.replace(/^#+\s*/, '').trim().toLowerCase()

const isEventsHeading = (heading: string) =>
  normalizeHeading(heading).replace(/:$/, '') === 'events'

/** Sorts after every real ISO date, so undated projects follow dated ones. */
const NO_DEADLINE = '9999-99-99'

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
  const isEventsBlock = (t: TaskflowTask) =>
    inFolder(t.filePath, config.dailyNotesFolder) &&
    t.heading != null &&
    isEventsHeading(t.heading)

  const visible = tasks.filter(
    t =>
      t.open &&
      t.description.trim() !== '' &&
      !isCalendarBlock(t, config) &&
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
  const isSlipped = (t: TaskflowTask) =>
    !isToday(t) &&
    ((t.due != null && t.due < config.today) ||
      (t.scheduled != null && t.scheduled < config.today))
  const slipped = visible
    .filter(isSlipped)
    .sort((a, b) => slippedDate(a).localeCompare(slippedDate(b)))

  // Every dated task stays visible somewhere: future-dated tasks outside the
  // projects folder (whose groups already show them) wait here, not nowhere.
  const upcomingDate = (t: TaskflowTask) => t.scheduled ?? t.due ?? ''
  const upcoming = visible
    .filter(
      t =>
        !isToday(t) &&
        !isSlipped(t) &&
        (t.scheduled != null || t.due != null) &&
        !inFolder(t.filePath, config.projectsFolder),
    )
    .sort((a, b) => upcomingDate(a).localeCompare(upcomingDate(b)))

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
      // Same urgency grammar as task due chips: red is for dates that have
      // actually arrived, deadline-day included.
      urgency:
        project.deadline == null
          ? null
          : project.deadline <= config.today
            ? ('arrived' as const)
            : ('ahead' as const),
    }))
    .filter(group => group.tasks.length > 0)
    // Deadline outranks status: a dated commitment is more urgent information
    // than now/next/later, so dated projects lead, soonest first. Undated
    // projects keep the status order — deadlines are optional, never hiding.
    .sort((a, b) => {
      const aDeadline = a.project.deadline ?? NO_DEADLINE
      const bDeadline = b.project.deadline ?? NO_DEADLINE
      return (
        aDeadline.localeCompare(bDeadline) ||
        statusRank(a.project.status) - statusRank(b.project.status) ||
        a.project.name.localeCompare(b.project.name)
      )
    })

  return {
    today: toTree(today),
    slipped: toTree(slipped),
    upcoming: toTree(upcoming),
    inbox: toTree(inbox),
    projects: projectGroups,
    wipNowCount: projects.filter(p => p.status === 'now').length,
  }
}
