import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

/** Modal for text input (replaces window.prompt) */
export class InputModal extends Modal {
  private result: string;
  private onSubmit: (result: string | null) => void;
  private placeholder: string;
  private title: string;

  constructor(app: App, title: string, placeholder: string, onSubmit: (result: string | null) => void) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.result = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h4", { text: this.title });

    new Setting(contentEl)
      .addText((text) =>
        text.setValue(this.placeholder).onChange((value) => {
          this.result = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onSubmit(null);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Modal for confirmation (replaces window.confirm) */
export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: (confirmed: boolean) => void;

  constructor(app: App, message: string, onConfirm: (confirmed: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onConfirm(true);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onConfirm(false);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
