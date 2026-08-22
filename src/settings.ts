import {PluginSettingTab, Setting} from 'obsidian'

import type {App} from 'obsidian'
import type TaskflowPlugin from './main'

export type SectionKey = 'today' | 'slipped' | 'inbox' | 'projects'

export type TaskflowSettings = {
  dailyNotesFolder: string
  projectsFolder: string
  appleSyncPath: string
  inboxHeading: string
  moveTargetHeading: string
  projectTemplatePath: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
}

export const DEFAULT_SETTINGS: TaskflowSettings = {
  dailyNotesFolder: 'Daily Notes',
  projectsFolder: 'Projects/Active',
  appleSyncPath: 'Indexes/System/Apple Sync.md',
  inboxHeading: 'Inbox',
  moveTargetHeading: 'Tasks',
  projectTemplatePath: 'Templates/project.md',
  wipLimit: 3,
  collapsed: {},
}

export class TaskflowSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: TaskflowPlugin,
  ) {
    super(app, plugin)
  }

  display(): void {
    this.containerEl.empty()

    const text = (
      name: string,
      desc: string,
      key:
        | 'dailyNotesFolder'
        | 'projectsFolder'
        | 'appleSyncPath'
        | 'inboxHeading'
        | 'moveTargetHeading'
        | 'projectTemplatePath',
      placeholder: string,
    ) =>
      new Setting(this.containerEl)
        .setName(name)
        .setDesc(desc)
        .addText(input =>
          input
            .setPlaceholder(placeholder)
            .setValue(this.plugin.settings[key])
            .onChange(async value => {
              await this.plugin.updateSettings({[key]: value.trim() || placeholder})
            }),
        )

    text(
      'Daily notes folder',
      'Where capture happens. Inbox only reads notes under this folder.',
      'dailyNotesFolder',
      DEFAULT_SETTINGS.dailyNotesFolder,
    )
    text(
      'Projects folder',
      'Notes here are projects; membership is location, status is frontmatter.',
      'projectsFolder',
      DEFAULT_SETTINGS.projectsFolder,
    )
    text(
      'Apple Sync note',
      'Machine-written note: its reminders are shown, its calendar blocks are not.',
      'appleSyncPath',
      DEFAULT_SETTINGS.appleSyncPath,
    )
    text(
      'Inbox heading',
      'Only tasks under this daily-note heading count as capture.',
      'inboxHeading',
      DEFAULT_SETTINGS.inboxHeading,
    )
    text(
      'Project template',
      'Note used by "New project…" during triage; {{title}} and {{date:YYYY-MM-DD}} are filled in.',
      'projectTemplatePath',
      DEFAULT_SETTINGS.projectTemplatePath,
    )
    text(
      'Move-target heading',
      'Where moved tasks land in a project note (used by triage; configurable for kanban-converted projects).',
      'moveTargetHeading',
      DEFAULT_SETTINGS.moveTargetHeading,
    )

    new Setting(this.containerEl)
      .setName('WIP limit')
      .setDesc('Projects allowed in "now" before the badge warns. Warns, never blocks.')
      .addText(input =>
        input.setValue(String(this.plugin.settings.wipLimit)).onChange(async value => {
          const parsed = Number.parseInt(value, 10)
          if (Number.isFinite(parsed) && parsed > 0) {
            await this.plugin.updateSettings({wipLimit: parsed})
          }
        }),
      )
  }
}
