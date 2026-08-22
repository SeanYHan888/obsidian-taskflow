import {Notice, TFile} from 'obsidian'

import {cancelLine, clearScheduled, setScheduled} from '../core/schedule'

import type {App} from 'obsidian'
import type {TaskflowTask} from '../core/types'

/**
 * Applies per-line transforms to tasks, one vault.process per file. Every line
 * is verified against the task's originalMarkdown before editing; stale lines
 * are skipped and reported, never guessed at.
 */
const editTaskLines = async (
  app: App,
  tasks: TaskflowTask[],
  transform: (line: string) => string,
): Promise<void> => {
  const byFile = new Map<string, TaskflowTask[]>()
  for (const task of tasks) {
    byFile.set(task.filePath, [...(byFile.get(task.filePath) ?? []), task])
  }

  let stale = 0
  for (const [path, fileTasks] of byFile) {
    const file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      stale += fileTasks.length
      continue
    }
    await app.vault.process(file, data => {
      const lines = data.split('\n')
      for (const task of fileTasks) {
        if (lines[task.line] !== task.originalMarkdown) {
          stale++
          continue
        }
        lines[task.line] = transform(task.originalMarkdown)
      }
      return lines.join('\n')
    })
  }
  if (stale > 0) {
    new Notice(`Taskflow: ${stale} task${stale === 1 ? '' : 's'} moved since last refresh — skipped`)
  }
}

export const rescheduleTasks = (app: App, tasks: TaskflowTask[], date: string) =>
  editTaskLines(app, tasks, line => setScheduled(line, date))

export const cancelTask = (app: App, task: TaskflowTask) =>
  editTaskLines(app, [task], cancelLine)

export const unscheduleTasks = (app: App, tasks: TaskflowTask[]) =>
  editTaskLines(app, tasks, clearScheduled)
