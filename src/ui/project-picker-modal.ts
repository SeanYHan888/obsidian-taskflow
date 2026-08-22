import {FuzzySuggestModal} from 'obsidian'

import type {App} from 'obsidian'
import type {ProjectMeta} from '../core/types'

export type ProjectChoice =
  | {kind: 'project'; project: ProjectMeta}
  | {kind: 'new'}

const NEW_ITEM: ProjectChoice = {kind: 'new'}

export class ProjectPickerModal extends FuzzySuggestModal<ProjectChoice> {
  constructor(
    app: App,
    private projects: ProjectMeta[],
    private onChoose: (choice: ProjectChoice) => void,
  ) {
    super(app)
    this.setPlaceholder('Move to project…')
  }

  getItems(): ProjectChoice[] {
    return [
      ...this.projects.map(project => ({kind: 'project', project}) as ProjectChoice),
      NEW_ITEM,
    ]
  }

  getItemText(item: ProjectChoice): string {
    return item.kind === 'new'
      ? '+ New project…'
      : `${item.project.name}  (${item.project.status ?? 'no status'})`
  }

  onChooseItem(item: ProjectChoice): void {
    this.onChoose(item)
  }
}
