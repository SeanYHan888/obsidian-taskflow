import {Modal} from 'obsidian'

import type {App} from 'obsidian'

export class PickDateModal extends Modal {
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
    const button = this.contentEl.createEl('button', {
      text: 'Schedule',
      cls: 'taskflow-modal-submit',
    })
    button.addEventListener('click', submit)
    input.focus()
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
