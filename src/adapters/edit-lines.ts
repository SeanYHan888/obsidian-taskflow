import {Notice, TFile} from 'obsidian'

import {toJournalEntry} from '../core/journal'
import {dateEditLabel, rescheduleLabel} from '../core/labels'
import {
  cancelLine,
  clearDue,
  clearScheduled,
  setDue,
  setScheduled,
  withTaskWords,
} from '../core/schedule'

import type {App} from 'obsidian'
import type {JournalEntry, LineRecord} from '../core/journal'
import type {TaskflowTask} from '../core/types'

/**
 * Applies per-line transforms to tasks, one vault.process per file. Every line
 * is verified against the task's sourceLine before editing; stale lines
 * are skipped and reported, never guessed at. Lines actually changed come back
 * as journal records so the action can be undone.
 */
const editTaskLines = async (
  app: App,
  tasks: TaskflowTask[],
  transform: (line: string) => string,
): Promise<LineRecord[]> => {
  const byFile = new Map<string, TaskflowTask[]>()
  for (const task of tasks) {
    byFile.set(task.filePath, [...(byFile.get(task.filePath) ?? []), task])
  }

  let stale = 0
  const records: LineRecord[] = []
  for (const [path, fileTasks] of byFile) {
    const file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      stale += fileTasks.length
      continue
    }
    await app.vault.process(file, data => {
      const lines = data.split('\n')
      for (const task of fileTasks) {
        if (lines[task.line] !== task.sourceLine) {
          stale++
          continue
        }
        const after = transform(task.sourceLine)
        if (after === task.sourceLine) continue
        lines[task.line] = after
        records.push({
          kind: 'replace',
          file: path,
          line: task.line,
          before: task.sourceLine,
          after,
        })
      }
      return lines.join('\n')
    })
  }
  if (stale > 0) {
    new Notice(`Taskflow: ${stale} task${stale === 1 ? '' : 's'} moved since last refresh — skipped`)
  }
  return records
}

export const rescheduleTasks = async (
  app: App,
  tasks: TaskflowTask[],
  date: string,
  today: string,
): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, tasks, line => setScheduled(line, date, today))
  return toJournalEntry(rescheduleLabel(records, date), records)
}

export const cancelTask = async (app: App, task: TaskflowTask): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, [task], cancelLine)
  return toJournalEntry('cancelled 1 task', records)
}

export const unscheduleTasks = async (
  app: App,
  tasks: TaskflowTask[],
): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, tasks, clearScheduled)
  return toJournalEntry(dateEditLabel('start', records.length, null), records)
}

export const setDueTasks = async (
  app: App,
  tasks: TaskflowTask[],
  date: string,
): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, tasks, line => setDue(line, date))
  return toJournalEntry(dateEditLabel('due', records.length, date), records)
}

export const clearDueTasks = async (
  app: App,
  tasks: TaskflowTask[],
): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, tasks, clearDue)
  return toJournalEntry(dateEditLabel('due', records.length, null), records)
}

/**
 * Edit text: the line's words change, nothing else on it does (see
 * withTaskWords). Journaled like any line edit.
 */
export const editTaskText = async (
  app: App,
  task: TaskflowTask,
  words: string,
): Promise<JournalEntry | null> => {
  const records = await editTaskLines(app, [task], line => withTaskWords(line, words))
  return toJournalEntry('edited the text of 1 task', records)
}
