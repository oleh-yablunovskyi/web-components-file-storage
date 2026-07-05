import { uploadFile } from '../api/files-api.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }

    dialog {
      border: 1px solid var(--color-border, #ddd);
      border-radius: 8px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }

    h2 {
      margin: 0 0 1.5rem;
      color: var(--color-text, #111);
    }

    .file-picker {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .file-name {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }

    button[type='submit'] {
      background: var(--color-primary, #2563eb);
      color: #fff;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .cancel,
    .choose {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #ddd);
      color: var(--color-text, #111);
    }

    .error {
      color: var(--color-error, #dc2626);
      font-size: 0.875rem;
      margin: 0 0 1rem;
    }
  </style>

  <dialog id="dialog">
    <form id="form">
      <h2>Upload file</h2>
      <input id="file" name="file" type="file" accept=".png,.jpg,.jpeg,.txt,.rar" hidden />
      <div class="file-picker">
        <button type="button" class="choose" id="choose">Choose file</button>
        <span class="file-name" id="filename">No file chosen</span>
      </div>
      <p class="error" id="error" hidden></p>
      <div class="actions">
        <button type="button" class="cancel" id="cancel">Cancel</button>
        <button type="submit" id="submit">Upload</button>
      </div>
    </form>
  </dialog>
`;

class UploadModal extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    const dialog = this.shadow.getElementById('dialog') as HTMLDialogElement;
    const form = this.shadow.getElementById('form') as HTMLFormElement;
    const fileInput = this.shadow.getElementById('file') as HTMLInputElement;
    const errorEl = this.shadow.getElementById('error') as HTMLParagraphElement;
    const submitBtn = this.shadow.getElementById('submit') as HTMLButtonElement;
    const cancelBtn = this.shadow.getElementById('cancel') as HTMLButtonElement;

    const chooseBtn = this.shadow.getElementById('choose') as HTMLButtonElement;
    const filenameEl = this.shadow.getElementById('filename') as HTMLSpanElement;

    const updateFileLabel = () => {
      const file = fileInput.files?.[0];
      chooseBtn.textContent = file ? 'Change file' : 'Choose file';
      filenameEl.textContent = file?.name ?? 'No file chosen';
    };

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', updateFileLabel);

    cancelBtn.addEventListener('click', () => dialog.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;

      const file = fileInput.files?.[0];
      if (!file) return;

      submitBtn.disabled = true;

      try {
        await uploadFile(file);
        form.reset();
        updateFileLabel();
        dialog.close();
        this.dispatchEvent(new CustomEvent('upload-success', { bubbles: true, composed: true }));
      } catch (err: any) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  open() {
    const dialog = this.shadow.getElementById('dialog') as HTMLDialogElement;
    dialog.showModal();
  }
}

customElements.define('upload-modal', UploadModal);
