import {Plugin} from 'obsidian'

import {DEFAULT_SETTINGS, TaskflowSettingTab} from './settings'
import {TASKFLOW_VIEW_TYPE, TaskflowView} from './view'

import type {TaskflowSettings} from './settings'

export default class TaskflowPlugin extends Plugin {
  settings: TaskflowSettings = {...DEFAULT_SETTINGS}

  async onload(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<TaskflowSettings> | null
    this.settings = {...DEFAULT_SETTINGS, ...loaded}

    this.registerView(TASKFLOW_VIEW_TYPE, leaf => new TaskflowView(leaf, this))
    this.addSettingTab(new TaskflowSettingTab(this.app, this))
    this.addCommand({
      id: 'open-panel',
      name: 'Open panel',
      callback: () => void this.activateView(),
    })

    this.app.workspace.onLayoutReady(() => void this.activateView(false))
  }

  async updateSettings(updates: Partial<TaskflowSettings>): Promise<void> {
    this.settings = {...this.settings, ...updates}
    await this.saveData(this.settings)
    for (const leaf of this.app.workspace.getLeavesOfType(TASKFLOW_VIEW_TYPE)) {
      const view = leaf.view
      if (view instanceof TaskflowView) view.refresh()
    }
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
