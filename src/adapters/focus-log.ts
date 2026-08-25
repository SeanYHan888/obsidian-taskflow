import {Notice, TFile, normalizePath} from 'obsidian'

import {editTaskLines} from './edit-lines'
import {formatSessionLine, incrementPomodoro} from '../core/focus'
import {toJournalEntry} from '../core/journal'
import {isMachineManaged} from '../core/machine-note'

import type {App} from 'obsidian'
import type {JournalEntry, LineRecord} from '../core/journal'
import type {FocusSessionRecord} from '../core/ports'
import type {TaskflowTask} from '../core/types'

/**
 * Appends one line at the end of the log note, creating it (and its folders)
 * on first use. The insert lands ahead of the file's final newline so the
 * log grows one line per session, and comes back as an insert record.
 */
const appendToLog = async (app: App, logPath: string, text: string): Promise<LineRecord[]> => {
  const path = normalizePath(logPath)
  let file = app.vault.getAbstractFileByPath(path)
  if (file == null) {
    const parent = path.split('/').slice(0, -1).join('/')
    if (parent !== '') {
      await app.vault.createFolder(parent).catch(() => undefined)
    }
    try {
      file = await app.vault.create(path, `${text}\n`)
    } catch {
      file = app.vault.getAbstractFileByPath(path)
    }
    if (file instanceof TFile) return [{kind: 'insert', file: path, line: 0, text}]
  }
  if (!(file instanceof TFile)) {
    new Notice(`Taskflow: couldn't write the focus log at ${path}`)
    return []
  }
  let index = 0
  await app.vault.process(file, data => {
    const lines = data.split('\n')
    index = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
    lines.splice(index, 0, text)
    return lines.join('\n')
  })
  return [{kind: 'insert', file: path, line: index, text}]
}

/** The two completion writes (#16), as one undoable journal entry. */
export const recordFocusSession = async (
  app: App,
  task: TaskflowTask | null,
  session: FocusSessionRecord,
  opts: {logPath: string; machineNotePath: string},
): Promise<JournalEntry | null> => {
  const records: LineRecord[] = []
  if (task != null && !isMachineManaged(task.filePath, opts)) {
    records.push(...(await editTaskLines(app, [task], incrementPomodoro)))
  }
  records.push(...(await appendToLog(app, opts.logPath, formatSessionLine(session))))
  return toJournalEntry(`logged a ${session.workMinutes}m focus session`, records)
}
