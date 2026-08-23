import {Notice, TFile, moment} from 'obsidian'

import {relationsFromLines} from '../core/hierarchy'
import {toJournalEntry} from '../core/journal'
import {plural} from '../core/labels'
import {cutTaskBlocks, insertUnderHeadingAt} from '../core/move'

import type {App} from 'obsidian'
import type {JournalEntry, LineRecord} from '../core/journal'
import type {TaskflowTask} from '../core/types'

export type MoveResult = {moved: number; entry: JournalEntry | null}

type RelocateOutcome = {
  moved: number
  duplicated: number
  skipped: number
  headingMissing: boolean
  records: LineRecord[]
}

/**
 * The one relocation shape both directions share: cut task blocks (each with
 * its subtask children) out of their source notes and append them under a
 * heading in the target note. Descendants come from relations parsed out of
 * the exact content being edited — never a cache that could lag the file.
 *
 * Ordering is duplicate-safe, never lossy: per source file, blocks are
 * appended to the target first and cut from the source second, and the cut
 * re-verifies the whole source against the pre-append snapshot. A file that
 * changed in the window keeps its lines (leaving a duplicate to clean up);
 * a task whose line no longer matches what was selected is skipped entirely.
 * Every landed and cut line becomes a journal record.
 */
const relocateTaskBlocks = async (
  app: App,
  tasks: TaskflowTask[],
  targetFile: TFile,
  heading: string,
  createMissing: boolean,
): Promise<RelocateOutcome> => {
  const byFile = new Map<string, TaskflowTask[]>()
  let skipped = 0
  for (const task of tasks) {
    if (task.filePath === targetFile.path) {
      skipped++
      continue
    }
    byFile.set(task.filePath, [...(byFile.get(task.filePath) ?? []), task])
  }

  let moved = 0
  let duplicated = 0
  let headingMissing = false
  const records: LineRecord[] = []
  for (const [path, fileTasks] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      skipped += fileTasks.length
      continue
    }

    const snapshotLines = (await app.vault.read(file)).split('\n')
    const valid = fileTasks.filter(t => snapshotLines[t.line] === t.sourceLine)
    skipped += fileTasks.length - valid.length
    if (valid.length === 0) continue

    const {blocks, removedLines} = cutTaskBlocks(
      snapshotLines,
      valid.map(t => t.line),
      relationsFromLines(snapshotLines),
    )

    let appended = false
    await app.vault.process(targetFile, data => {
      const insertion = insertUnderHeadingAt(data.split('\n'), heading, blocks, {createMissing})
      if (!insertion) {
        headingMissing = true
        return data
      }
      appended = true
      insertion.inserted.forEach((text, i) =>
        records.push({kind: 'insert', file: targetFile.path, line: insertion.insertAt + i, text}),
      )
      return insertion.lines.join('\n')
    })
    if (!appended) break

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
    if (cut) {
      moved += blocks.length
      for (const line of removedLines) {
        records.push({kind: 'remove', file: path, line, text: snapshotLines[line]})
      }
    } else {
      duplicated += blocks.length
    }
  }

  return {moved, duplicated, skipped, headingMissing, records}
}

/** Move to project (CONTEXT.md): triage's filing edit, and drag's project drop. */
export const moveTasksToProject = async (
  app: App,
  tasks: TaskflowTask[],
  projectPath: string,
  targetHeading: string,
): Promise<MoveResult> => {
  const projectFile = app.vault.getAbstractFileByPath(projectPath)
  if (!(projectFile instanceof TFile)) {
    new Notice(`Taskflow: project note not found: ${projectPath}`)
    return {moved: 0, entry: null}
  }

  const outcome = await relocateTaskBlocks(app, tasks, projectFile, targetHeading, true)

  if (outcome.duplicated > 0) {
    new Notice(
      `Taskflow: ${plural(outcome.duplicated)} copied but not cut — the source note changed mid-move; remove the originals by hand`,
    )
  }
  if (outcome.skipped > 0) {
    new Notice(
      `Taskflow: ${plural(outcome.skipped)} not moved (changed since selection, or already in the target note)`,
    )
  }
  const total = outcome.moved + outcome.duplicated
  const projectName = (projectPath.split('/').pop() ?? projectPath).replace(/\.md$/, '')
  return {
    moved: total,
    entry: toJournalEntry(`moved ${plural(total)} to ${projectName}`, outcome.records),
  }
}

/**
 * Today's daily note path, resolved the way the Daily Notes core plugin does:
 * its configured folder and moment format (which may contain subfolders).
 * The one walk into Obsidian's private internals lives here.
 */
export const todayDailyNotePath = (app: App, today: string): string => {
  const internal = (
    app as unknown as {
      internalPlugins?: {
        getPluginById?: (id: string) => {instance?: {options?: {folder?: string; format?: string}}} | null
      }
    }
  ).internalPlugins?.getPluginById?.('daily-notes')
  const options = internal?.instance?.options ?? {}
  const folder = (options.folder ?? '').replace(/\/$/, '')
  const name = moment(today).format(options.format || 'YYYY-MM-DD')
  return `${folder ? folder + '/' : ''}${name}.md`
}

/**
 * The inverse of moveTasksToProject: backlog tasks return to today's daily
 * note under the inbox heading — back into triage. Refuses when today's note
 * or its inbox heading is missing: the panel edits task lines only, it never
 * creates or restructures notes.
 */
export const sendTasksBackToInbox = async (
  app: App,
  tasks: TaskflowTask[],
  inboxHeading: string,
  today: string,
): Promise<MoveResult> => {
  const dailyPath = todayDailyNotePath(app, today)
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath)
  if (!(dailyFile instanceof TFile)) {
    new Notice(`Taskflow: today's daily note not found (${dailyPath}) — create it first`)
    return {moved: 0, entry: null}
  }

  const outcome = await relocateTaskBlocks(app, tasks, dailyFile, inboxHeading, false)

  if (outcome.headingMissing) {
    new Notice(
      `Taskflow: no "${inboxHeading}" heading in today's daily note — nothing sent back`,
    )
  }
  if (outcome.duplicated > 0) {
    new Notice(
      `Taskflow: ${plural(outcome.duplicated)} copied but not cut — the project note changed mid-move; remove the originals by hand`,
    )
  }
  if (outcome.skipped > 0) {
    new Notice(
      `Taskflow: ${plural(outcome.skipped)} not sent back (changed since, or already in today's note)`,
    )
  }
  const total = outcome.moved + outcome.duplicated
  return {
    moved: total,
    entry: toJournalEntry(`sent ${plural(total)} back to inbox`, outcome.records),
  }
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
