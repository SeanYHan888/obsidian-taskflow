import {ItemView, Menu, Modal, TFile, debounce} from 'obsidian'
import {mount, unmount} from 'svelte'

import Panel from './ui/Panel.svelte'
import {classifySections} from './core/classify'
import {flattenTaskTree} from './core/hierarchy'
import {resolveQuickDate} from './core/schedule'
import {getTasksPlugin, readTasks, toggleTask} from './adapters/tasks-plugin'
import {cancelTask, rescheduleTask, rescheduleTasks} from './adapters/edit-lines'
import {readProjects} from './adapters/projects'

import type {App, EventRef, WorkspaceLeaf} from 'obsidian'
import type {QuickDate} from './core/schedule'
import type {Sections, TaskflowTask} from './core/types'
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

class PickDateModal extends Modal {
  constructor(
    app: App,
    private defaultDate: string,
    private onPick: (date: string) => void,
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Schedule for…')
    const input = this.contentEl.createEl('input', {type: 'date'})
    input.value = this.defaultDate
    const submit = () => {
      if (input.value) this.onPick(input.value)
      this.close()
    }
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') submit()
    })
    const button = this.contentEl.createEl('button', {text: 'Schedule'})
    button.style.marginLeft = '8px'
    button.addEventListener('click', submit)
    input.focus()
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

export class TaskflowView extends ItemView {
  private panel: {update: (data: PanelData) => void} | null = null
  private lastToday = localToday()
  private lastSections: Sections | null = null

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
          onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) =>
            this.showScheduleMenu(task, ev),
          onSchedule: (task: TaskflowTask, kind: QuickDate) =>
            void this.reschedule(task, resolveQuickDate(kind, localToday())),
          onPickDate: (task: TaskflowTask) => this.pickDate(task),
          onCancelTask: (task: TaskflowTask) => void this.cancel(task),
          onRescheduleAllSlipped: () => void this.rescheduleAllSlipped(),
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
      this.lastSections = null
      this.panel.update({
        sections: null,
        tasksPluginMissing: true,
        today,
        wipLimit: settings.wipLimit,
        collapsed: settings.collapsed,
        sourceLabels: {},
        appleSyncPath: settings.appleSyncPath,
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

    this.lastSections = sections
    this.panel.update({
      sections,
      tasksPluginMissing: false,
      today,
      wipLimit: settings.wipLimit,
      collapsed: settings.collapsed,
      sourceLabels,
      appleSyncPath: settings.appleSyncPath,
    })
  }

  private showScheduleMenu(task: TaskflowTask, ev: MouseEvent): void {
    const today = localToday()
    const menu = new Menu()
    const stamp = (kind: QuickDate) => () =>
      void this.reschedule(task, resolveQuickDate(kind, today))
    menu.addItem(item => item.setTitle('Today').setIcon('sun').onClick(stamp('today')))
    menu.addItem(item =>
      item.setTitle('Tomorrow').setIcon('sunrise').onClick(stamp('tomorrow')),
    )
    menu.addItem(item =>
      item.setTitle('Weekend').setIcon('armchair').onClick(stamp('weekend')),
    )
    menu.addItem(item =>
      item.setTitle('Pick a date…').setIcon('calendar').onClick(() => this.pickDate(task)),
    )
    menu.showAtMouseEvent(ev)
  }

  private pickDate(task: TaskflowTask): void {
    new PickDateModal(this.app, localToday(), date =>
      void this.reschedule(task, date),
    ).open()
  }

  private async reschedule(task: TaskflowTask, date: string): Promise<void> {
    await rescheduleTask(this.app, task, date)
    this.refresh()
  }

  private async cancel(task: TaskflowTask): Promise<void> {
    await cancelTask(this.app, task)
    this.refresh()
  }

  private async rescheduleAllSlipped(): Promise<void> {
    if (!this.lastSections) return
    const appleSyncPath = this.plugin.settings.appleSyncPath
    const slipped = flattenTaskTree(this.lastSections.slipped).filter(
      t => t.filePath !== appleSyncPath,
    )
    if (slipped.length === 0) return
    await rescheduleTasks(this.app, slipped, localToday())
    this.refresh()
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
