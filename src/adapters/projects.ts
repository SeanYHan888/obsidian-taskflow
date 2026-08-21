import {inFolder} from '../core/classify'

import type {App} from 'obsidian'
import type {ProjectMeta, ProjectStatus} from '../core/types'

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['now', 'next', 'later'])

/**
 * Projects are notes in the projects folder; membership is location, status is
 * frontmatter. Retired statuses (done/dropped) fall out of the panel entirely.
 */
export const readProjects = (app: App, projectsFolder: string): ProjectMeta[] => {
  return app.vault
    .getMarkdownFiles()
    .filter(file => inFolder(file.path, projectsFolder))
    .map(file => {
      const rawStatus = app.metadataCache.getFileCache(file)?.frontmatter?.status
      const status =
        typeof rawStatus === 'string' && ACTIVE_STATUSES.has(rawStatus)
          ? (rawStatus as ProjectStatus)
          : typeof rawStatus === 'string'
            ? undefined
            : null
      return {file, status}
    })
    .filter(({status}) => status !== undefined)
    .map(({file, status}) => ({
      path: file.path,
      name: file.basename,
      status: status as ProjectStatus | null,
    }))
}
