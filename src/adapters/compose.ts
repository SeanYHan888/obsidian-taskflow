import {TFolder, normalizePath} from 'obsidian'

import {cancelTask, rescheduleTasks, unscheduleTasks} from './edit-lines'
import {recordFocusSession} from './focus-log'
import {
  addTaskToProject,
  createProjectFromTemplate,
  dailyNotesConfig,
  moveTasksToProject,
  sendTasksBackToInbox,
} from './move-tasks'
import {
  archiveProject,
  readProjects,
  setProjectDeadline,
  setProjectStatus,
} from './projects'
import {getTasksPlugin, onTasksChange, readTasks, toggleTask} from './tasks-plugin'

import type {App} from 'obsidian'
import type {Ports} from '../core/ports'
import type {SetupFacts} from '../core/setup'
import type {TaskflowSettings} from '../settings'

/**
 * Wires the adapter implementations to the core ports (ADR-0004) — the one
 * module that names them. Settings are read through the getter on every call,
 * so a settings change needs no rewiring.
 */
/**
 * The environment facts setupState maps to messages (#6). Gathered on every
 * refresh, never once at load — a plugin the user enables later must be
 * noticed without a restart.
 */
export const gatherSetupFacts = (app: App, settings: TaskflowSettings): SetupFacts => ({
  tasksPluginAvailable: getTasksPlugin(app) != null,
  dailyNotesConfigured: dailyNotesConfig(app) != null,
  projectsFolderExists:
    app.vault.getAbstractFileByPath(normalizePath(settings.projectsFolder)) instanceof TFolder,
  templateConfigured: settings.projectTemplatePath !== '',
  templateExists:
    settings.projectTemplatePath !== '' &&
    app.vault.getAbstractFileByPath(normalizePath(settings.projectTemplatePath)) != null,
})

/**
 * Where daily notes live: the Daily Notes plugin's folder when it is on,
 * the setting as fallback — so inbox classification and send-back agree.
 */
export const effectiveDailyNotesFolder = (app: App, settings: TaskflowSettings): string =>
  dailyNotesConfig(app)?.folder ?? settings.dailyNotesFolder

export const createPorts = (app: App, settings: () => TaskflowSettings): Ports => ({
  tasks: {
    available: () => getTasksPlugin(app) != null,
    read: () => readTasks(app),
    toggle: task => toggleTask(app, task),
    onChange: listener => onTasksChange(app, listener),
  },
  projects: {
    read: () => readProjects(app, settings().projectsFolder),
    setStatus: (path, status) => setProjectStatus(app, path, status),
    setDeadline: (path, deadline) => setProjectDeadline(app, path, deadline),
    archive: (path, status) => archiveProject(app, path, status, settings().archiveFolder),
    create: async (name, today) => {
      const current = settings()
      const file = await createProjectFromTemplate(
        app,
        name,
        current.projectsFolder,
        current.projectTemplatePath,
        current.moveTargetHeading,
        today,
      )
      return file?.path ?? null
    },
  },
  editor: {
    reschedule: (tasks, date) => rescheduleTasks(app, tasks, date),
    unschedule: tasks => unscheduleTasks(app, tasks),
    cancel: task => cancelTask(app, task),
    moveToProject: (tasks, projectPath) =>
      moveTasksToProject(app, tasks, projectPath, settings().moveTargetHeading),
    sendBackToInbox: (tasks, today) =>
      sendTasksBackToInbox(app, tasks, settings().inboxHeading, today),
    addTask: (projectPath, text) =>
      addTaskToProject(app, projectPath, text, settings().moveTargetHeading),
    recordFocusSession: (task, session) =>
      recordFocusSession(app, task, session, {
        logPath: settings().focusLogPath,
        machineNotePath: settings().machineNotePath,
      }),
  },
})
