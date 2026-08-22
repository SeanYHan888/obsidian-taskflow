import {Notice, TFile} from 'obsidian'

import {relationsFromLines} from '../core/hierarchy'
import {cutTaskBlocks, insertUnderHeading} from '../core/move'

import type {App} from 'obsidian'
import type {TaskflowTask} from '../core/types'

/**
 * Moves tasks (each with its subtask children) into a project note's
 * move-target heading. Descendants come from relations parsed out of the exact
 * content being edited — never a cache that could lag the file.
 *
 * Ordering is duplicate-safe, never lossy: per source file, blocks are
 * appended to the project first and cut from the source second, and the cut
 * re-verifies every line of every block against what was appended. A file that
 * changed in the window keeps its lines (leaving a duplicate to clean up) and
 * says so; a task whose root no longer matches what was selected is skipped
 * entirely.
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
  let skipped = 0
  for (const task of tasks) {
    if (task.filePath === projectPath) {
      skipped++
      continue
    }
    byFile.set(task.filePath, [...(byFile.get(task.filePath) ?? []), task])
  }

  let moved = 0
  let duplicated = 0
  for (const [path, fileTasks] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      skipped += fileTasks.length
      continue
    }

    const snapshotLines = (await app.vault.read(file)).split('\n')
    const valid = fileTasks.filter(t => snapshotLines[t.line] === t.originalMarkdown)
    skipped += fileTasks.length - valid.length
    if (valid.length === 0) continue

    const {blocks} = cutTaskBlocks(
      snapshotLines,
      valid.map(t => t.line),
      relationsFromLines(snapshotLines),
    )

    await app.vault.process(projectFile, data =>
      insertUnderHeading(data.split('\n'), targetHeading, blocks).join('\n'),
    )

    let cut = false
    await app.vault.process(file, data => {
      const lines = data.split('\n')
      if (
        lines.length !== snapshotLines.length ||
        lines.some((line, i) => line !== snapshotLines[i])
      ) {
        return data
      }
      cut = true
      return cutTaskBlocks(lines, valid.map(t => t.line), relationsFromLines(lines))
        .remaining.join('\n')
    })
    if (cut) moved += blocks.length
    else duplicated += blocks.length
  }

  if (duplicated > 0) {
    new Notice(
      `Taskflow: ${duplicated} task${duplicated === 1 ? '' : 's'} copied but not cut — the source note changed mid-move; remove the originals by hand`,
    )
  }
  if (skipped > 0) {
    new Notice(
      `Taskflow: ${skipped} task${skipped === 1 ? '' : 's'} not moved (changed since selection, or already in the target note)`,
    )
  }
  return moved + duplicated
}

const FALLBACK_TEMPLATE = (name: string, today: string, headingLine: string) => `---
created: "${today}"
type: project
project_id: "${name}"
status: later
tags:
  - project
---
# ${name}

${headingLine}

## Notes
`

/**
 * Creates a project note from the template (project_id = note name,
 * status: later). Falls back to a minimal frontmatter — using the configured
 * move-target heading, never a hardcoded one — when the template is missing.
 * Returns the existing note if the name is already taken.
 */
export const createProjectFromTemplate = async (
  app: App,
  rawName: string,
  projectsFolder: string,
  templatePath: string,
  targetHeading: string,
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
  if (templateFile instanceof TFile) {
    const content = (await app.vault.read(templateFile))
      .replaceAll('{{title}}', name)
      .replaceAll('{{date:YYYY-MM-DD}}', today)
    return app.vault.create(path, content)
  }

  const explicitMarks = targetHeading.trim().match(/^#{1,6}(?=\s)/)?.[0]
  const headingLine = `${explicitMarks ?? '##'} ${targetHeading.replace(/^#+\s*/, '').trim()}`
  return app.vault.create(path, FALLBACK_TEMPLATE(name, today, headingLine))
}
