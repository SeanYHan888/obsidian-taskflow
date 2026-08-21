import {Notice, TFile} from 'obsidian'

import type {App} from 'obsidian'
import type {TaskflowTask} from '../core/types'

/** The slice of the Tasks plugin we rely on. Its absence is a first-class state. */
type TasksPluginLike = {
  getTasks(): unknown[]
  apiV1?: {
    executeToggleTaskDoneCommand(line: string, path: string): string
  }
}

export const getTasksPlugin = (app: App): TasksPluginLike | null => {
  const plugins = (app as unknown as {plugins?: {plugins?: Record<string, unknown>}})
    .plugins?.plugins
  const tasks = plugins?.['obsidian-tasks-plugin'] as
    | (TasksPluginLike & Record<string, unknown>)
    | undefined
  return tasks && typeof tasks.getTasks === 'function' ? tasks : null
}

const isoDate = (value: unknown): string | null => {
  const moment = value as {isValid?: () => boolean; format?: (f: string) => string} | null
  if (!moment || typeof moment.format !== 'function') return null
  if (typeof moment.isValid === 'function' && !moment.isValid()) return null
  return moment.format('YYYY-MM-DD')
}

/**
 * Projects the Tasks plugin's live cache into core's task model.
 * Parent lines come from the metadata cache's list-item relations, the same
 * source the subtask hierarchy has always used.
 */
export const readTasks = (app: App): TaskflowTask[] => {
  const plugin = getTasksPlugin(app)
  if (!plugin) return []

  const parentByLineByPath = new Map<string, Map<number, number>>()
  const parentLineFor = (path: string, line: number): number | undefined => {
    let byLine = parentByLineByPath.get(path)
    if (!byLine) {
      byLine = new Map()
      const file = app.vault.getAbstractFileByPath(path)
      if (file instanceof TFile) {
        for (const item of app.metadataCache.getFileCache(file)?.listItems ?? []) {
          byLine.set(item.position.start.line, item.parent)
        }
      }
      parentByLineByPath.set(path, byLine)
    }
    const parent = byLine.get(line)
    return parent != null && parent >= 0 ? parent : undefined
  }

  const tasks: TaskflowTask[] = []
  for (const raw of plugin.getTasks()) {
    const t = raw as {
      description?: string
      originalMarkdown?: string
      status?: {type?: string}
      scheduledDate?: unknown
      dueDate?: unknown
      taskLocation?: {path?: string; lineNumber?: number; precedingHeader?: string | null}
    }
    const path = t.taskLocation?.path
    const line = t.taskLocation?.lineNumber
    if (path == null || line == null) continue

    const statusType = t.status?.type ?? 'TODO'
    tasks.push({
      description: t.description ?? '',
      originalMarkdown: t.originalMarkdown ?? '',
      filePath: path,
      line,
      open: statusType === 'TODO' || statusType === 'IN_PROGRESS',
      scheduled: isoDate(t.scheduledDate),
      due: isoDate(t.dueDate),
      heading: t.taskLocation?.precedingHeader ?? null,
      parentLine: parentLineFor(path, line),
      children: [],
    })
  }
  return tasks
}

/**
 * Completes a task through the Tasks plugin so ✅ done-dates, recurrence, and
 * Apple Reminders write-back keep working (ADR-0001) — there is deliberately no
 * degraded write path without the API. The source line is verified before
 * editing; a stale line aborts with a Notice instead of writing.
 */
export const toggleTask = async (app: App, task: TaskflowTask): Promise<void> => {
  const file = app.vault.getAbstractFileByPath(task.filePath)
  if (!(file instanceof TFile)) return

  const api = getTasksPlugin(app)?.apiV1
  if (!api || typeof api.executeToggleTaskDoneCommand !== 'function') {
    new Notice('Taskflow: Tasks plugin API unavailable — task not completed')
    return
  }
  let stale = false
  await app.vault.process(file, data => {
    const lines = data.split('\n')
    if (lines[task.line] !== task.originalMarkdown) {
      stale = true
      return data
    }
    lines[task.line] = api.executeToggleTaskDoneCommand(
      task.originalMarkdown,
      task.filePath,
    )
    return lines.join('\n')
  })
  if (stale) new Notice('Taskflow: task moved since last refresh — refreshing instead')
}
