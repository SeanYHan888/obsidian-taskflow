import {Notice, TFile} from 'obsidian'

import {cutTaskBlocks, insertUnderHeading} from '../core/move'

import type {App} from 'obsidian'
import type {ListItemRelation} from '../core/hierarchy'
import type {TaskflowTask} from '../core/types'

/**
 * Moves tasks (each with its subtask children) into a project note's
 * move-target heading. One vault.process per source file; every root line is
 * re-verified against its originalMarkdown just before cutting, and mismatches
 * are skipped with a Notice — never edit a line that no longer matches what
 * was selected. The target note is resolved up front so nothing is cut when
 * the destination is missing.
 */
export const moveTasksToProject = async (
  app: App,
  tasks: TaskflowTask[],
  projectPath: string,
  targetHeading: string,
): Promise<number> => {
  const projectFile = app.vault.getAbstractFileByPath(projectPath)
  if (!(projectFile instanceof TFile)) {
    new Notice(`Taskflow: project note not found: ${projectPath}`)
    return 0
  }

  const byFile = new Map<string, TaskflowTask[]>()
  for (const task of tasks) {
    if (task.filePath === projectPath) continue
    byFile.set(task.filePath, [...(byFile.get(task.filePath) ?? []), task])
  }

  let skipped = 0
  const allBlocks: string[][] = []
  for (const [path, fileTasks] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      skipped += fileTasks.length
      continue
    }
    const relations: ListItemRelation[] = (
      app.metadataCache.getFileCache(file)?.listItems ?? []
    ).map(item => ({line: item.position.start.line, parent: item.parent}))

    await app.vault.process(file, data => {
      const lines = data.split('\n')
      const valid = fileTasks.filter(t => lines[t.line] === t.originalMarkdown)
      skipped += fileTasks.length - valid.length
      if (valid.length === 0) return data
      const {remaining, blocks} = cutTaskBlocks(
        lines,
        valid.map(t => t.line),
        relations,
      )
      allBlocks.push(...blocks)
      return remaining.join('\n')
    })
  }

  if (allBlocks.length > 0) {
    await app.vault.process(projectFile, data =>
      insertUnderHeading(data.split('\n'), targetHeading, allBlocks).join('\n'),
    )
  }
  if (skipped > 0) {
    new Notice(
      `Taskflow: ${skipped} task${skipped === 1 ? '' : 's'} changed since last refresh — not moved`,
    )
  }
  return allBlocks.length
}

const FALLBACK_TEMPLATE = (name: string, today: string) => `---
created: "${today}"
type: project
project_id: "${name}"
status: later
tags:
  - project
---
# ${name}

## Tasks

## Notes
`

/**
 * Creates a project note from the template (project_id = note name,
 * status: later). Falls back to a minimal frontmatter when the template is
 * missing. Returns the existing note if the name is already taken.
 */
export const createProjectFromTemplate = async (
  app: App,
  rawName: string,
  projectsFolder: string,
  templatePath: string,
  today: string,
): Promise<TFile | null> => {
  const name = rawName.replace(/[\\/:#^[\]|]/g, ' ').trim()
  if (!name) return null
  const path = `${projectsFolder.replace(/\/$/, '')}/${name}.md`

  const existing = app.vault.getAbstractFileByPath(path)
  if (existing instanceof TFile) {
    new Notice(`Taskflow: project "${name}" already exists — moving into it`)
    return existing
  }

  const templateFile = app.vault.getAbstractFileByPath(templatePath)
  const content =
    templateFile instanceof TFile
      ? (await app.vault.read(templateFile))
          .replaceAll('{{title}}', name)
          .replaceAll('{{date:YYYY-MM-DD}}', today)
      : FALLBACK_TEMPLATE(name, today)

  return app.vault.create(path, content)
}
