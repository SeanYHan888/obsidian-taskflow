import {Modal} from 'obsidian'

import type {App} from 'obsidian'

/** One question, one destructive-ish button. Escape/backdrop cancels. */
export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private body: string,
    private confirmLabel: string,
    private onConfirm: () => void,
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText(this.title)
    this.contentEl.createEl('p', {text: this.body})
    const button = this.contentEl.createEl('button', {
      text: this.confirmLabel,
      cls: 'taskflow-modal-submit',
    })
    button.addEventListener('click', () => {
      this.close()
      this.onConfirm()
    })
    button.focus()
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
