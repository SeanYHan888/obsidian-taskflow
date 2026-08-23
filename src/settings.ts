import {PluginSettingTab, Setting} from 'obsidian'

import type {App} from 'obsidian'
import type TaskflowPlugin from './main'

export type SectionKey = 'today' | 'slipped' | 'upcoming' | 'inbox' | 'projects'

export type TaskflowSettings = {
  dailyNotesFolder: string
  projectsFolder: string
  archiveFolder: string
  /** Optional: a note some sync tool rewrites (see core/machine-note.ts). '' = none. */
  machineNotePath: string
  inboxHeading: string
  moveTargetHeading: string
  /** Optional: '' falls back to the built-in project scaffold. */
  projectTemplatePath: string
  wipLimit: number
  collapsed: Partial<Record<SectionKey, boolean>>
  /** Folded project groups, keyed by project note path. */
  collapsedProjects: Record<string, boolean>
}

export const DEFAULT_SETTINGS: TaskflowSettings = {
  dailyNotesFolder: 'Daily Notes',
  projectsFolder: 'Projects/Active',
  archiveFolder: 'Projects/Archive',
  machineNotePath: '',
  inboxHeading: 'Inbox',
  moveTargetHeading: 'Tasks',
  projectTemplatePath: '',
  wipLimit: 3,
  collapsed: {},
  collapsedProjects: {},
}

/** Pre-rename key (was Apple-Sync-specific); migrated on load, never written back. */
export type LegacySettings = {appleSyncPath?: string}

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
      key: {[K in keyof TaskflowSettings]: TaskflowSettings[K] extends string ? K : never}[keyof TaskflowSettings],
      placeholder: string,
      /** Optional fields may be blanked; required ones fall back to the default. */
      optional = false,
    ) =>
      new Setting(this.containerEl)
        .setName(name)
        .setDesc(desc)
        .addText(input =>
          input
            .setPlaceholder(placeholder)
            .setValue(this.plugin.settings[key])
            .onChange(async value => {
              await this.plugin.updateSettings({
                [key]: value.trim() || (optional ? '' : placeholder),
              })
            }),
        )

    text(
      'Daily notes folder',
      'Fallback for when the core Daily Notes plugin is off — otherwise its configured folder is used. The inbox only reads notes under this folder.',
      'dailyNotesFolder',
      DEFAULT_SETTINGS.dailyNotesFolder,
    )
    text(
      'Projects folder',
      'Notes in this folder are projects. A task belongs to a project because its line lives in that note.',
      'projectsFolder',
      DEFAULT_SETTINGS.projectsFolder,
    )
    text(
      'Archive folder',
      'Where retired project notes go when marked done or dropped.',
      'archiveFolder',
      DEFAULT_SETTINGS.archiveFolder,
    )
    text(
      'Machine-managed note',
      'Optional. A note some sync tool rewrites on its own (for example an Apple Reminders sync). Its dated reminders appear; its scheduled time blocks do not; its rows allow check-off only. Leave blank if no tool owns a note.',
      'machineNotePath',
      'Sync/Reminders.md',
      true,
    )
    text(
      'Inbox heading',
      'Only tasks under this daily-note heading count as capture. Plain text match — any language works.',
      'inboxHeading',
      DEFAULT_SETTINGS.inboxHeading,
    )
    text(
      'Project template',
      'Optional. Note used by "New project…"; {{title}} and {{date:YYYY-MM-DD}} are filled in. Leave blank to use a built-in scaffold.',
      'projectTemplatePath',
      'Templates/project.md',
      true,
    )
    text(
      'Move-target heading',
      'Where moved tasks land in a project note. Configurable so a project note can double as a kanban board.',
      'moveTargetHeading',
      DEFAULT_SETTINGS.moveTargetHeading,
    )

    new Setting(this.containerEl)
      .setName('Work-in-progress limit')
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
