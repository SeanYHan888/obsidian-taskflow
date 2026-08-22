import {Modal} from 'obsidian'

import type {App} from 'obsidian'

export class NewProjectModal extends Modal {
  constructor(
    app: App,
    private onSubmit: (name: string) => void,
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('New project')
    const input = this.contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Project name',
    })
    input.addClass('taskflow-modal-input')
    const submit = () => {
      const name = input.value.trim()
      if (!name) return
      this.onSubmit(name)
      this.close()
    }
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') submit()
    })
    const button = this.contentEl.createEl('button', {
      text: 'Create and move',
      cls: 'taskflow-modal-submit',
    })
    button.addEventListener('click', submit)
    input.focus()
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
