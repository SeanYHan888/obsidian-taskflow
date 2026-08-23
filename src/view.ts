import {ItemView, Keymap, Menu, Notice, Platform, TFile, debounce} from 'obsidian'
import {mount, unmount} from 'svelte'

import Panel from './ui/Panel.svelte'
import {ConfirmModal} from './ui/confirm-modal'
import {PickDateModal} from './ui/pick-date-modal'
import {NewProjectModal} from './ui/new-project-modal'
import {ProjectPickerModal} from './ui/project-picker-modal'
import {classifySections, inFolder} from './core/classify'
import {dropIntent} from './core/drop'
import {flattenTaskTree} from './core/hierarchy'
import {resolveQuickDate} from './core/schedule'
import {getTasksPlugin, readTasks, toggleTask} from './adapters/tasks-plugin'
import {cancelTask, rescheduleTasks, unscheduleTasks} from './adapters/edit-lines'
import {
  createProjectFromTemplate,
  moveTasksToProject,
  sendTasksBackToInbox,
} from './adapters/move-tasks'
import {
  archiveProject,
  readProjects,
  setProjectDeadline,
  setProjectStatus,
} from './adapters/projects'

import type {EventRef, WorkspaceLeaf} from 'obsidian'
import type {DropTarget} from './core/drop'
import type {JournalEntry} from './core/journal'
import type {QuickDate} from './core/schedule'
import type {ProjectMeta, ProjectStatus, Sections, TaskflowTask} from './core/types'
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
          onOpenTask: (task: TaskflowTask, ev?: MouseEvent) =>
            void this.openFile(task.filePath, task.line, ev),
          onOpenFile: (path: string, ev?: MouseEvent) => void this.openFile(path, undefined, ev),
          onCollapse: (key: SectionKey, collapsed: boolean) =>
            void this.setCollapsed(key, collapsed),
          onCollapseProject: (path: string, collapsed: boolean) =>
            void this.setProjectCollapsed(path, collapsed),
          onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) =>
            this.showScheduleMenu([task], ev),
          onSchedule: (task: TaskflowTask, kind: QuickDate) =>
            void this.reschedule([task], resolveQuickDate(kind, localToday())),
          onUnschedule: (task: TaskflowTask) => void this.unschedule([task]),
          onPickDate: (task: TaskflowTask) => this.pickDate([task]),
          onCancelTask: (task: TaskflowTask) => void this.cancel(task),
          onRescheduleAllSlipped: () => void this.rescheduleAllSlipped(),
          onBulkMove: (tasks: TaskflowTask[]) => this.bulkMove(tasks),
          onBulkScheduleMenu: (tasks: TaskflowTask[], ev: MouseEvent) =>
            this.showScheduleMenu(tasks, ev),
          onDrop: (task: TaskflowTask, target: DropTarget, ev: DragEvent) =>
            this.handleDrop(task, target, ev),
          onProjectMenu: (project: ProjectMeta, ev: MouseEvent) =>
            this.showProjectMenu(project, ev),
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
        collapsedProjects: settings.collapsedProjects,
        draggable: Platform.isDesktop,
        sourceLabels: {},
        appleSyncPath: settings.appleSyncPath,
        projectsFolder: settings.projectsFolder,
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
      collapsedProjects: settings.collapsedProjects,
      draggable: Platform.isDesktop,
      sourceLabels,
      appleSyncPath: settings.appleSyncPath,
      projectsFolder: settings.projectsFolder,
    })
  }

  private showScheduleMenu(tasks: TaskflowTask[], ev: MouseEvent): void {
    const today = localToday()
    const menu = new Menu()
    const stamp = (kind: QuickDate) => () =>
      void this.reschedule(tasks, resolveQuickDate(kind, today))
    menu.addItem(item =>
      item.setTitle('To-do (today)').setIcon('sun').onClick(stamp('today')),
    )
    menu.addItem(item =>
      item.setTitle('Tomorrow').setIcon('sunrise').onClick(stamp('tomorrow')),
    )
    menu.addItem(item =>
      item.setTitle('Weekend').setIcon('armchair').onClick(stamp('weekend')),
    )
    menu.addItem(item =>
      item.setTitle('Pick a date…').setIcon('calendar').onClick(() => this.pickDate(tasks)),
    )
    const fromProject =
      tasks.length > 0 &&
      tasks.every(t => inFolder(t.filePath, this.plugin.settings.projectsFolder))
    if (tasks.some(t => t.scheduled != null) || fromProject) {
      menu.addSeparator()
    }
    if (tasks.some(t => t.scheduled != null)) {
      menu.addItem(item =>
        item
          .setTitle('Remove date')
          .setIcon('eraser')
          .onClick(() => void this.unschedule(tasks)),
      )
    }
    if (fromProject) {
      menu.addItem(item =>
        item
          .setTitle('Move to project…')
          .setIcon('folder-input')
          .onClick(() => this.bulkMove(tasks)),
      )
      menu.addItem(item =>
        item
          .setTitle('Send back to inbox')
          .setIcon('inbox')
          .onClick(() => void this.sendBack(tasks)),
      )
    }
    menu.showAtMouseEvent(ev)
  }

  /**
   * A drop is a way of pointing at an edit that already exists: resolve the
   * intent in core and dispatch to the same methods the buttons use.
   */
  private handleDrop(task: TaskflowTask, target: DropTarget, ev: DragEvent): void {
    const settings = this.plugin.settings
    const intent = dropIntent(task, target, {
      appleSyncPath: settings.appleSyncPath,
      projectsFolder: settings.projectsFolder,
      today: localToday(),
    })
    if (intent.kind === 'schedule-today') void this.reschedule([task], localToday())
    else if (intent.kind === 'remove-date') void this.unschedule([task])
    else if (intent.kind === 'move-to-project') void this.moveTo([task], intent.path)
    else if (intent.kind === 'send-back-to-inbox') void this.sendBack([task])
    else if (intent.kind === 'ask-date') this.showScheduleMenu([task], ev)
  }

  private showProjectMenu(project: ProjectMeta, ev: MouseEvent): void {
    const menu = new Menu()
    menu.addItem(item =>
      item
        .setTitle('Open project note')
        .setIcon('file-text')
        .onClick(() => void this.openFile(project.path)),
    )
    menu.addSeparator()
    for (const status of ['now', 'next', 'later'] as ProjectStatus[]) {
      menu.addItem(item =>
        item
          .setTitle(status === project.status ? `${status} ✓` : status)
          .setIcon(status === 'now' ? 'play' : status === 'next' ? 'clock' : 'moon')
          .setDisabled(status === project.status)
          .onClick(() => void this.changeStatus(project, status)),
      )
    }
    menu.addSeparator()
    menu.addItem(item =>
      item
        .setTitle(project.deadline == null ? 'Set deadline…' : `Deadline ${project.deadline}…`)
        .setIcon('calendar-clock')
        .onClick(() => this.pickProjectDeadline(project)),
    )
    if (project.deadline != null) {
      menu.addItem(item =>
        item
          .setTitle('Clear deadline')
          .setIcon('eraser')
          .onClick(() => void this.changeDeadline(project, null)),
      )
    }
    menu.addSeparator()
    menu.addItem(item =>
      item
        .setTitle('Mark done & archive')
        .setIcon('check-circle')
        .onClick(() => this.retireProject(project, 'done')),
    )
    menu.addItem(item =>
      item
        .setTitle('Mark dropped & archive')
        .setIcon('circle-off')
        .onClick(() => this.retireProject(project, 'dropped')),
    )
    menu.showAtMouseEvent(ev)
  }

  private async changeStatus(project: ProjectMeta, status: ProjectStatus): Promise<void> {
    if (await setProjectStatus(this.app, project.path, status)) {
      new Notice(`Taskflow: ${project.name} → ${status}`)
    }
    this.refresh()
  }

  private pickProjectDeadline(project: ProjectMeta): void {
    new PickDateModal(
      this.app,
      project.deadline ?? localToday(),
      date => void this.changeDeadline(project, date),
      'Project deadline…',
      'Set deadline',
    ).open()
  }

  /** Like status flips, deadline edits are frontmatter — not journaled. */
  private async changeDeadline(project: ProjectMeta, deadline: string | null): Promise<void> {
    if (await setProjectDeadline(this.app, project.path, deadline)) {
      new Notice(
        deadline == null
          ? `Taskflow: ${project.name} deadline cleared`
          : `Taskflow: ${project.name} deadline → ${deadline}`,
      )
    }
    this.refresh()
  }

  /**
   * Retiring is not journaled (frontmatter + file move, not task lines) —
   * the note itself, moved intact, is the undo. Open tasks are never edited;
   * when some remain, they confirm first, because an archived note's tasks
   * leave the panel.
   */
  private retireProject(project: {path: string; name: string}, status: 'done' | 'dropped'): void {
    const group = this.lastSections?.projects.find(g => g.project.path === project.path)
    const openCount = group ? flattenTaskTree(group.tasks).length : 0
    const archive = async () => {
      const archived = await archiveProject(
        this.app,
        project.path,
        status,
        this.plugin.settings.archiveFolder,
      )
      if (archived) {
        new Notice(
          `Taskflow: ${project.name} marked ${status} — archived to ${this.plugin.settings.archiveFolder}`,
        )
      }
      this.refresh()
    }
    if (openCount === 0) {
      void archive()
      return
    }
    new ConfirmModal(
      this.app,
      `Mark ${project.name} ${status}?`,
      `${openCount} open task${openCount === 1 ? ' remains' : 's remain'} and will leave the panel with the note. The lines themselves are kept untouched.`,
      `Mark ${status} & archive`,
      () => void archive(),
    ).open()
  }

  /** Journals the action and shows its notice with an undo link attached. */
  private record(entry: JournalEntry | null): void {
    if (!entry) return
    this.plugin.pushJournal(entry)
    const fragment = document.createDocumentFragment()
    fragment.append(`Taskflow: ${entry.label} — `)
    const link = document.createElement('a')
    link.textContent = 'undo'
    link.addEventListener('click', () => void this.plugin.undo(entry))
    fragment.append(link)
    new Notice(fragment, 8000)
  }

  private pickDate(tasks: TaskflowTask[]): void {
    new PickDateModal(this.app, localToday(), date =>
      void this.reschedule(tasks, date),
    ).open()
  }

  private async reschedule(tasks: TaskflowTask[], date: string): Promise<void> {
    this.record(await rescheduleTasks(this.app, tasks, date))
    this.refresh()
  }

  private async unschedule(tasks: TaskflowTask[]): Promise<void> {
    this.record(await unscheduleTasks(this.app, tasks))
    this.refresh()
  }

  private async sendBack(tasks: TaskflowTask[]): Promise<void> {
    this.record(
      (await sendTasksBackToInbox(this.app, tasks, this.plugin.settings.inboxHeading)).entry,
    )
    this.refresh()
  }

  // The select UI already refuses Apple Sync rows; this filter is the
  // structural backstop for the machine-rewritten note (ADR-0003).
  private bulkMove(allTasks: TaskflowTask[]): void {
    const settings = this.plugin.settings
    const tasks = allTasks.filter(t => t.filePath !== settings.appleSyncPath)
    if (tasks.length === 0) return
    new ProjectPickerModal(this.app, readProjects(this.app, settings.projectsFolder), choice => {
      if (choice.kind === 'project') void this.moveTo(tasks, choice.project.path)
      else new NewProjectModal(this.app, name => void this.createAndMove(tasks, name)).open()
    }).open()
  }

  private async moveTo(tasks: TaskflowTask[], projectPath: string): Promise<void> {
    const {entry} = await moveTasksToProject(
      this.app,
      tasks,
      projectPath,
      this.plugin.settings.moveTargetHeading,
    )
    this.record(entry)
    this.refresh()
  }

  private async createAndMove(tasks: TaskflowTask[], name: string): Promise<void> {
    const settings = this.plugin.settings
    const file = await createProjectFromTemplate(
      this.app,
      name,
      settings.projectsFolder,
      settings.projectTemplatePath,
      settings.moveTargetHeading,
      localToday(),
    )
    if (file) await this.moveTo(tasks, file.path)
  }

  private async cancel(task: TaskflowTask): Promise<void> {
    this.record(await cancelTask(this.app, task))
    this.refresh()
  }

  // Bulk-writes from the last projection, not a fresh read — safe because
  // edit-lines verifies every line against its originalMarkdown at write time,
  // so anything that changed since the last refresh is skipped, not guessed at.
  private async rescheduleAllSlipped(): Promise<void> {
    if (!this.lastSections) return
    const appleSyncPath = this.plugin.settings.appleSyncPath
    const slipped = flattenTaskTree(this.lastSections.slipped).filter(
      t => t.filePath !== appleSyncPath,
    )
    if (slipped.length === 0) return
    this.record(await rescheduleTasks(this.app, slipped, localToday()))
    this.refresh()
  }

  private async toggle(task: TaskflowTask): Promise<void> {
    await toggleTask(this.app, task)
    this.refresh()
  }

  /**
   * The single choke point for every panel jump. Obsidian's keymap resolves
   * the event's modifiers (mod+click → tab, mod+alt → split, middle-click…);
   * no event means the current tab, today's default.
   */
  private async openFile(path: string, line?: number, ev?: MouseEvent): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) return
    const leaf = this.app.workspace.getLeaf(ev ? Keymap.isModEvent(ev) : false)
    await leaf.openFile(file, line == null ? undefined : {eState: {line}})
  }

  private async setCollapsed(key: SectionKey, collapsed: boolean): Promise<void> {
    await this.plugin.updateSettings({
      collapsed: {...this.plugin.settings.collapsed, [key]: collapsed},
    })
  }

  private async setProjectCollapsed(path: string, collapsed: boolean): Promise<void> {
    const next = {...this.plugin.settings.collapsedProjects}
    if (collapsed) next[path] = true
    else delete next[path]
    await this.plugin.updateSettings({collapsedProjects: next})
  }
}
