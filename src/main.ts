import {Notice, Plugin} from 'obsidian'

import {createPorts} from './adapters/compose'
import {undoEntry} from './adapters/undo'
import {
  IDLE_FOCUS,
  reanchorTask,
  startFocus as focusStart,
  statusBarLabel,
  tickFocus,
} from './core/focus'
import {flattenTaskTree, locationKey} from './core/hierarchy'
import {DEFAULT_SETTINGS, TaskflowSettingTab} from './settings'
import {TASKFLOW_VIEW_TYPE, TaskflowView} from './view'

import type {CompletedWork, FocusConfig, FocusState} from './core/focus'
import type {JournalEntry} from './core/journal'
import type {Ports} from './core/ports'
import type {TaskflowTask} from './core/types'
import type {LegacySettings, TaskflowSettings} from './settings'

const JOURNAL_DEPTH = 50

export default class TaskflowPlugin extends Plugin {
  settings: TaskflowSettings = {...DEFAULT_SETTINGS}
  /** Session undo journal (ADR-0001): a log of edits, in memory only. */
  private journal: JournalEntry[] = []
  /**
   * The focus timer (#16) lives on the plugin, not the view, so a running
   * session survives the panel closing. In memory only — an Obsidian restart
   * ends it (stateless projection: no timer state in data.json).
   */
  private focus: FocusState = IDLE_FOCUS
  private focusPorts: Ports | null = null
  private focusBar: HTMLElement | null = null
  private focusInterval: number | null = null

  async onload(): Promise<void> {
    const loaded = (await this.loadData()) as (Partial<TaskflowSettings> & LegacySettings) | null
    // Existing installs keep their machine-managed note across the key rename.
    if (loaded?.appleSyncPath != null && loaded.machineNotePath == null) {
      loaded.machineNotePath = loaded.appleSyncPath
    }
    delete loaded?.appleSyncPath
    this.settings = {...DEFAULT_SETTINGS, ...loaded}

    this.registerView(TASKFLOW_VIEW_TYPE, leaf => new TaskflowView(leaf, this))
    this.addSettingTab(new TaskflowSettingTab(this.app, this))
    this.addRibbonIcon('list-checks', 'Open Taskflow', () => void this.activateView())
    this.addCommand({
      id: 'open-panel',
      name: 'Open panel',
      callback: () => void this.activateView(),
    })
    this.addCommand({
      id: 'undo-last-panel-action',
      name: 'Undo last panel action',
      callback: () => void this.undo(),
    })
    this.addCommand({
      id: 'cancel-focus-session',
      name: 'Cancel focus session',
      checkCallback: checking => {
        if (this.focus.phase === 'idle') return false
        if (!checking) this.cancelFocus()
        return true
      },
    })

    // The countdown, visible only while a session runs. Clicking cancels —
    // the touch/keyboard path is the command, per the accelerator rule.
    this.focusBar = this.addStatusBarItem()
    this.focusBar.addClass('taskflow-focus-bar', 'mod-clickable')
    this.focusBar.setAttribute('aria-label', 'Focus session — click to cancel')
    this.focusBar.addEventListener('click', () => this.cancelFocus())
    this.focusBar.hide()

    this.app.workspace.onLayoutReady(() => void this.activateView(false))
  }

  /** The plugin shell's own port graph — the timer outlives any one view. */
  private get ports(): Ports {
    return (this.focusPorts ??= createPorts(this.app, () => this.settings))
  }

  private focusConfig(): FocusConfig {
    return {
      workMinutes: this.settings.focusWorkMinutes,
      breakMinutes: this.settings.focusBreakMinutes,
    }
  }

  /** One session at a time: starting over a running one abandons it, unlogged. */
  startFocus(task: TaskflowTask): void {
    const {state, abandoned} = focusStart(this.focus, task, Date.now(), this.focusConfig())
    this.focus = state
    if (abandoned) {
      new Notice(`Taskflow: focus on "${abandoned.description}" abandoned — nothing logged`)
    }
    new Notice(`Taskflow: 🍅 ${this.settings.focusWorkMinutes}m on "${task.description}"`)
    if (this.focusInterval == null) {
      this.focusInterval = this.registerInterval(
        window.setInterval(() => this.tickFocus(), 1000),
      )
    }
    this.renderFocusBar()
    this.refreshViews()
  }

  /** Ends the session without writing anywhere — an interval elapses or it cancels. */
  cancelFocus(): void {
    if (this.focus.phase === 'idle') return
    const abandoned = this.focus.phase === 'work' ? this.focus.task.description : null
    this.focus = IDLE_FOCUS
    this.stopFocusInterval()
    this.renderFocusBar()
    new Notice(
      abandoned == null
        ? 'Taskflow: break skipped'
        : `Taskflow: focus on "${abandoned}" cancelled — nothing logged`,
    )
    this.refreshViews()
  }

  /** The focused task's row identity, for the panel's highlight and menu ✓. */
  focusLocation(): string | null {
    return this.focus.phase === 'work'
      ? locationKey(this.focus.task.filePath, this.focus.task.line)
      : null
  }

  private tickFocus(): void {
    const {state, completed, breakEnded} = tickFocus(this.focus, Date.now(), this.focusConfig())
    this.focus = state
    if (state.phase === 'idle') this.stopFocusInterval()
    this.renderFocusBar()
    if (completed) void this.recordFocus(completed)
    if (breakEnded) {
      if (this.settings.focusNotify) new Notice('Taskflow: ☕ break over')
      this.refreshViews()
    }
  }

  /**
   * The two completion writes, against the task's *current* line: the
   * start-time snapshot is a work interval old, so it is re-anchored in
   * the live projection first (a vanished task still gets its log line).
   */
  private async recordFocus(completed: CompletedWork): Promise<void> {
    const current = reanchorTask(completed.task, flattenTaskTree(this.ports.tasks.read()))
    const entry = await this.ports.editor.recordFocusSession(current, {
      startedAt: completed.startedAt,
      endedAt: completed.endedAt,
      workMinutes: completed.workMinutes,
      taskText: completed.task.description,
    })
    if (entry) this.pushJournal(entry)
    if (this.settings.focusNotify) {
      new Notice(`Taskflow: 🍅 ${completed.workMinutes}m on "${completed.task.description}" logged`)
    }
    this.refreshViews()
  }

  private stopFocusInterval(): void {
    if (this.focusInterval != null) window.clearInterval(this.focusInterval)
    this.focusInterval = null
  }

  private renderFocusBar(): void {
    if (!this.focusBar) return
    const label = statusBarLabel(this.focus, Date.now())
    if (label == null) {
      this.focusBar.hide()
      return
    }
    this.focusBar.setText(label)
    this.focusBar.show()
  }

  pushJournal(entry: JournalEntry): void {
    this.journal.push(entry)
    if (this.journal.length > JOURNAL_DEPTH) this.journal.shift()
  }

  /** Undoes the given entry (an undo notice's own action), or the latest one. */
  async undo(entry?: JournalEntry): Promise<void> {
    const target = entry ?? this.journal[this.journal.length - 1]
    if (!target) {
      new Notice('Taskflow: nothing to undo')
      return
    }
    const index = this.journal.lastIndexOf(target)
    if (index === -1) {
      new Notice('Taskflow: that action was already undone')
      return
    }
    this.journal.splice(index, 1)
    const {stale} = await undoEntry(this.app, target)
    new Notice(
      stale > 0
        ? `Taskflow: undid "${target.label}" — ${stale} line${stale === 1 ? '' : 's'} changed since last refresh — skipped`
        : `Taskflow: undid "${target.label}"`,
    )
    this.refreshViews()
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TASKFLOW_VIEW_TYPE)) {
      const view = leaf.view
      if (view instanceof TaskflowView) view.refresh()
    }
  }

  async updateSettings(updates: Partial<TaskflowSettings>): Promise<void> {
    this.settings = {...this.settings, ...updates}
    await this.saveData(this.settings)
    this.refreshViews()
  }

  private async activateView(reveal = true): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TASKFLOW_VIEW_TYPE)[0]
    if (existing) {
      if (reveal) await this.app.workspace.revealLeaf(existing)
      return
    }
    const leaf = this.app.workspace.getRightLeaf(false)
    if (!leaf) return
    await leaf.setViewState({type: TASKFLOW_VIEW_TYPE, active: reveal})
    if (reveal) {
      const created = this.app.workspace.getLeavesOfType(TASKFLOW_VIEW_TYPE)[0]
      if (created) await this.app.workspace.revealLeaf(created)
    }
  }
}
