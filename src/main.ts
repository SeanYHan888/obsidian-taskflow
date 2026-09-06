import {Notice, Plugin} from 'obsidian'

import {undoEntry} from './adapters/undo'
import {DEFAULT_SETTINGS, TaskflowSettingTab} from './settings'
import {TASKFLOW_VIEW_TYPE, TaskflowView} from './view'

import type {JournalEntry} from './core/journal'
import type {LegacySettings, TaskflowSettings} from './settings'

const JOURNAL_DEPTH = 50

export default class TaskflowPlugin extends Plugin {
  settings: TaskflowSettings = {...DEFAULT_SETTINGS}
  /** Session undo journal (ADR-0001): a log of edits, in memory only. */
  private journal: JournalEntry[] = []

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

    this.app.workspace.onLayoutReady(() => void this.activateView(false))
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
