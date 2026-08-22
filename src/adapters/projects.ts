import {Notice, TFile, normalizePath} from 'obsidian'

import {inFolder} from '../core/classify'

import type {App} from 'obsidian'
import type {ProjectMeta, ProjectStatus} from '../core/types'

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['now', 'next', 'later'])

/** Anything that isn't a plain ISO date string is treated as no deadline. */
const readDeadline = (raw: unknown): string | null =>
  typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null

/**
 * Projects are notes in the projects folder; membership is location, status is
 * frontmatter. Retired statuses (done/dropped) fall out of the panel entirely.
 */
export const readProjects = (app: App, projectsFolder: string): ProjectMeta[] => {
  return app.vault
    .getMarkdownFiles()
    .filter(file => inFolder(file.path, projectsFolder))
    .map(file => {
      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter
      const rawStatus = frontmatter?.status
      const status =
        typeof rawStatus === 'string' && ACTIVE_STATUSES.has(rawStatus)
          ? (rawStatus as ProjectStatus)
          : typeof rawStatus === 'string'
            ? undefined
            : null
      return {file, status, deadline: readDeadline(frontmatter?.deadline)}
    })
    .filter(({status}) => status !== undefined)
    .map(({file, status, deadline}) => ({
      path: file.path,
      name: file.basename,
      status: status as ProjectStatus | null,
      deadline,
    }))
}

/** Stamps an active status (now/next/later) into the project's frontmatter. */
export const setProjectStatus = async (
  app: App,
  projectPath: string,
  status: ProjectStatus,
): Promise<boolean> => {
  const file = app.vault.getAbstractFileByPath(projectPath)
  if (!(file instanceof TFile)) {
    new Notice(`Taskflow: project note not found: ${projectPath}`)
    return false
  }
  await app.fileManager.processFrontMatter(file, frontmatter => {
    frontmatter.status = status
  })
  return true
}

/**
 * Stamps (or clears, on null) the project's deadline in frontmatter. Like
 * status flips, not journaled — the frontmatter is the text-editable record.
 */
export const setProjectDeadline = async (
  app: App,
  projectPath: string,
  deadline: string | null,
): Promise<boolean> => {
  const file = app.vault.getAbstractFileByPath(projectPath)
  if (!(file instanceof TFile)) {
    new Notice(`Taskflow: project note not found: ${projectPath}`)
    return false
  }
  await app.fileManager.processFrontMatter(file, frontmatter => {
    if (deadline == null) delete frontmatter.deadline
    else frontmatter.deadline = deadline
  })
  return true
}

/**
 * Retires a project: stamps the terminal status into frontmatter and moves
 * the note to the archive folder (renameFile, so links keep working). Task
 * lines are never touched — retiring silences a project, never erases it.
 * The status flip alone already removes it from the panel, so a failed move
 * leaves a consistent, visible-in-vault state.
 */
export const archiveProject = async (
  app: App,
  projectPath: string,
  status: 'done' | 'dropped',
  archiveFolder: string,
): Promise<boolean> => {
  const file = app.vault.getAbstractFileByPath(projectPath)
  if (!(file instanceof TFile)) {
    new Notice(`Taskflow: project note not found: ${projectPath}`)
    return false
  }

  const folder = normalizePath(archiveFolder)
  const target = normalizePath(`${folder}/${file.name}`)
  if (app.vault.getAbstractFileByPath(target)) {
    new Notice(`Taskflow: "${file.basename}" already exists in ${folder} — move it by hand`)
    return false
  }

  await app.fileManager.processFrontMatter(file, frontmatter => {
    frontmatter.status = status
  })
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder)
  }
  await app.fileManager.renameFile(file, target)
  return true
}
