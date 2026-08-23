import {ItemView, Keymap, Menu, Notice, Platform, TFile, debounce} from 'obsidian'
import {mount, unmount} from 'svelte'

import Panel from './ui/Panel.svelte'
import {askDate, askText, confirm, pickProject} from './ui/prompts'
import {classifySections} from './core/classify'
import {dropIntent} from './core/drop'
import {flattenTaskTree} from './core/hierarchy'
import {editableTasks} from './core/machine-note'
import {projectMenuSpec, scheduleMenuSpec} from './core/menus'
import {resolveQuickDate} from './core/schedule'
import {retirePlan} from './core/sections'
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
import type {MenuAction, MenuItemSpec} from './core/menus'
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
          onProjectToggle: (path: string, folded: boolean, ev: MouseEvent) =>
            Keymap.isModEvent(ev)
              ? void this.openFile(path, undefined, ev)
              : void this.setProjectCollapsed(path, !folded),
          onScheduleMenu: (task: TaskflowTask, ev: MouseEvent) =>
            this.showScheduleMenu([task], ev),
          onSchedule: (task: TaskflowTask, kind: QuickDate) =>
            void this.reschedule([task], resolveQuickDate(kind, localToday())),
          onUnschedule: (task: TaskflowTask) => void this.unschedule([task]),
          onPickDate: (task: TaskflowTask) => void this.pickDate([task]),
          onCancelTask: (task: TaskflowTask) => void this.cancel(task),
          onRescheduleAllSlipped: () => void this.rescheduleAllSlipped(),
          onBulkMove: (tasks: TaskflowTask[]) => void this.bulkMove(tasks),
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
        machineNotePath: settings.machineNotePath,
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
      machineNotePath: settings.machineNotePath,
      inboxHeading: settings.inboxHeading,
    })

    this.lastSections = sections
    this.panel.update({
      sections,
      tasksPluginMissing: false,
      today,
      wipLimit: settings.wipLimit,
      collapsed: settings.collapsed,
      collapsedProjects: settings.collapsedProjects,
      draggable: Platform.isDesktop,
      machineNotePath: settings.machineNotePath,
      projectsFolder: settings.projectsFolder,
    })
  }

  /** Turns a core menu spec into an Obsidian Menu at the event's position. */
  private runMenu(spec: MenuItemSpec[], ev: MouseEvent, run: (action: MenuAction) => void): void {
    const menu = new Menu()
    for (const entry of spec) {
      if (entry.kind === 'separator') menu.addSeparator()
      else {
        menu.addItem(item =>
          item
            .setTitle(entry.title)
            .setIcon(entry.icon)
            .setDisabled(entry.disabled ?? false)
            .onClick(() => run(entry.action)),
        )
      }
    }
    menu.showAtMouseEvent(ev)
  }

  private showScheduleMenu(tasks: TaskflowTask[], ev: MouseEvent): void {
    this.runMenu(scheduleMenuSpec(tasks, this.plugin.settings), ev, action => {
      if (action.type === 'schedule')
        void this.reschedule(tasks, resolveQuickDate(action.kind, localToday()))
      else if (action.type === 'pick-date') void this.pickDate(tasks)
      else if (action.type === 'remove-date') void this.unschedule(tasks)
      else if (action.type === 'move-to-project') void this.bulkMove(tasks)
      else if (action.type === 'send-back') void this.sendBack(tasks)
    })
  }

  /**
   * A drop is a way of pointing at an edit that already exists: resolve the
   * intent in core and dispatch to the same methods the buttons use.
   */
  private handleDrop(task: TaskflowTask, target: DropTarget, ev: DragEvent): void {
    const settings = this.plugin.settings
    // The same clock snapshot the panel highlighted targets with — validity
    // and execution must agree, even across midnight.
    const intent = dropIntent(task, target, {
      machineNotePath: settings.machineNotePath,
      projectsFolder: settings.projectsFolder,
      today: this.lastToday,
    })
    if (intent.kind === 'schedule-today') void this.reschedule([task], localToday())
    else if (intent.kind === 'remove-date') void this.unschedule([task])
    else if (intent.kind === 'move-to-project') void this.moveTo([task], intent.path)
    else if (intent.kind === 'send-back-to-inbox') void this.sendBack([task])
    else if (intent.kind === 'ask-date') this.showScheduleMenu([task], ev)
  }

  private showProjectMenu(project: ProjectMeta, ev: MouseEvent): void {
    this.runMenu(projectMenuSpec(project), ev, action => {
      if (action.type === 'open-note') void this.openFile(project.path)
      else if (action.type === 'set-status') void this.changeStatus(project, action.status)
      else if (action.type === 'pick-deadline') void this.pickProjectDeadline(project)
      else if (action.type === 'clear-deadline') void this.changeDeadline(project, null)
      else if (action.type === 'retire') void this.retireProject(project, action.status)
    })
  }

  private async changeStatus(project: ProjectMeta, status: ProjectStatus): Promise<void> {
    if (await setProjectStatus(this.app, project.path, status)) {
      new Notice(`Taskflow: ${project.name} → ${status}`)
    }
    this.refresh()
  }

  private async pickProjectDeadline(project: ProjectMeta): Promise<void> {
    const date = await askDate(this.app, {
      defaultDate: project.deadline ?? localToday(),
      title: 'Project deadline…',
      submitLabel: 'Set deadline',
    })
    if (date) await this.changeDeadline(project, date)
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
  private async retireProject(
    project: {path: string; name: string},
    status: 'done' | 'dropped',
  ): Promise<void> {
    const {openCount, needsConfirm} = retirePlan(this.lastSections, project.path)
    if (needsConfirm) {
      const confirmed = await confirm(this.app, {
        title: `Mark ${project.name} ${status}?`,
        body: `${openCount} open task${openCount === 1 ? ' remains' : 's remain'} and will leave the panel with the note. The lines themselves are kept untouched.`,
        confirmLabel: `Mark ${status} & archive`,
      })
      if (!confirmed) return
    }
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

  private async pickDate(tasks: TaskflowTask[]): Promise<void> {
    const date = await askDate(this.app, {defaultDate: localToday()})
    if (date) await this.reschedule(tasks, date)
  }

  /** The uniform write pipeline: run the edit, journal + notice it, reproject. */
  private async act(run: () => Promise<JournalEntry | null>): Promise<void> {
    this.record(await run())
    this.refresh()
  }

  private reschedule(tasks: TaskflowTask[], date: string): Promise<void> {
    return this.act(() => rescheduleTasks(this.app, tasks, date))
  }

  private unschedule(tasks: TaskflowTask[]): Promise<void> {
    return this.act(() => unscheduleTasks(this.app, tasks))
  }

  private sendBack(tasks: TaskflowTask[]): Promise<void> {
    return this.act(async () =>
      (await sendTasksBackToInbox(this.app, tasks, this.plugin.settings.inboxHeading)).entry,
    )
  }

  private async bulkMove(allTasks: TaskflowTask[]): Promise<void> {
    const settings = this.plugin.settings
    const tasks = editableTasks(allTasks, settings)
    if (tasks.length === 0) return
    const choice = await pickProject(this.app, readProjects(this.app, settings.projectsFolder))
    if (!choice) return
    if (choice.kind === 'project') {
      await this.moveTo(tasks, choice.project.path)
    } else {
      const name = await askText(this.app, {
        title: 'New project',
        placeholder: 'Project name',
        submitLabel: 'Create and move',
      })
      if (name) await this.createAndMove(tasks, name)
    }
  }

  private moveTo(tasks: TaskflowTask[], projectPath: string): Promise<void> {
    return this.act(async () =>
      (
        await moveTasksToProject(
          this.app,
          tasks,
          projectPath,
          this.plugin.settings.moveTargetHeading,
        )
      ).entry,
    )
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

  private cancel(task: TaskflowTask): Promise<void> {
    return this.act(() => cancelTask(this.app, task))
  }

  // Bulk-writes from the last projection, not a fresh read — safe because
  // edit-lines verifies every line against its originalMarkdown at write time,
  // so anything that changed since the last refresh is skipped, not guessed at.
  private async rescheduleAllSlipped(): Promise<void> {
    if (!this.lastSections) return
    const slipped = editableTasks(flattenTaskTree(this.lastSections.slipped), this.plugin.settings)
    if (slipped.length === 0) return
    await this.reschedule(slipped, localToday())
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
