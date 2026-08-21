import {ItemView, TFile, debounce} from 'obsidian'
import {mount, unmount} from 'svelte'

import Panel from './ui/Panel.svelte'
import {classifySections} from './core/classify'
import {getTasksPlugin, readTasks, toggleTask} from './adapters/tasks-plugin'
import {readProjects} from './adapters/projects'

import type {EventRef, WorkspaceLeaf} from 'obsidian'
import type {TaskflowTask} from './core/types'
import type {PanelData} from './ui/panel-types'
import type {SectionKey} from './settings'
import type TaskflowPlugin from './main'

export const TASKFLOW_VIEW_TYPE = 'taskflow'

const localToday = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export class TaskflowView extends ItemView {
  private panel: {update: (data: PanelData) => void} | null = null
  private lastToday = localToday()

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: TaskflowPlugin,
  ) {
    super(leaf)
  }

  getViewType(): string {
    return TASKFLOW_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Taskflow'
  }

  getIcon(): string {
    return 'list-checks'
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty()
    this.panel = mount(Panel, {
      target: this.contentEl,
      props: {
        callbacks: {
          onToggleTask: (task: TaskflowTask) => void this.toggle(task),
          onOpenTask: (task: TaskflowTask) => void this.openTask(task),
          onOpenFile: (path: string) => void this.openFile(path),
          onCollapse: (key: SectionKey, collapsed: boolean) =>
            void this.setCollapsed(key, collapsed),
        },
      },
    }) as unknown as {update: (data: PanelData) => void}

    const refreshSoon = debounce(() => this.refresh(), 350, true)
    const workspaceEvents = this.app.workspace as unknown as {
      on(name: string, cb: () => void): EventRef
    }
    this.registerEvent(workspaceEvents.on('obsidian-tasks-plugin:cache-update', refreshSoon))
    this.registerEvent(this.app.metadataCache.on('changed', refreshSoon))
    this.registerInterval(
      window.setInterval(() => {
        if (localToday() !== this.lastToday) this.refresh()
      }, 60_000),
    )

    this.refresh()
  }

  async onClose(): Promise<void> {
    if (this.panel) await unmount(this.panel)
    this.panel = null
  }

  refresh(): void {
    if (!this.panel) return
    const settings = this.plugin.settings
    const today = localToday()
    this.lastToday = today

    if (!getTasksPlugin(this.app)) {
      this.panel.update({
        sections: null,
        tasksPluginMissing: true,
        today,
        wipLimit: settings.wipLimit,
        collapsed: settings.collapsed,
        sourceLabels: {},
      })
      return
    }

    const tasks = readTasks(this.app)
    const projects = readProjects(this.app, settings.projectsFolder)
    const sections = classifySections(tasks, projects, {
      today,
      dailyNotesFolder: settings.dailyNotesFolder,
      projectsFolder: settings.projectsFolder,
      appleSyncPath: settings.appleSyncPath,
      inboxHeading: settings.inboxHeading,
    })

    const sourceLabels: Record<string, string> = {}
    for (const task of tasks) {
      if (sourceLabels[task.filePath]) continue
      sourceLabels[task.filePath] =
        task.filePath === settings.appleSyncPath
          ? 'Apple Sync'
          : (task.filePath.split('/').pop() ?? '').replace(/\.md$/, '')
    }

    this.panel.update({
      sections,
      tasksPluginMissing: false,
      today,
      wipLimit: settings.wipLimit,
      collapsed: settings.collapsed,
      sourceLabels,
    })
  }

  private async toggle(task: TaskflowTask): Promise<void> {
    await toggleTask(this.app, task)
    this.refresh()
  }

  private async openTask(task: TaskflowTask): Promise<void> {
    await this.openFile(task.filePath, task.line)
  }

  private async openFile(path: string, line?: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) return
    const leaf = this.app.workspace.getLeaf(false)
    await leaf.openFile(file, line == null ? undefined : {eState: {line}})
  }

  private async setCollapsed(key: SectionKey, collapsed: boolean): Promise<void> {
    await this.plugin.updateSettings({
      collapsed: {...this.plugin.settings.collapsed, [key]: collapsed},
    })
  }
}
