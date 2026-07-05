import { listFiles, type FileMeta } from '../api/files-api.js';
import './file-row.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .message {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
    }
  </style>

  <div class="list" id="list"></div>
`;

class FileList extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.refresh();
  }

  async refresh() {
    const list = this.shadow.getElementById('list')!;
    list.innerHTML = '';

    try {
      const files = await listFiles();

      if (files.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'message';
        empty.textContent = 'No files yet — upload your first.';
        list.appendChild(empty);
        return;
      }

      for (const file of files) {
        const row = document.createElement('file-row') as HTMLElement & { file: FileMeta };
        row.file = file;
        list.appendChild(row);
      }
    } catch (err: any) {
      const error = document.createElement('p');
      error.className = 'message';
      error.textContent = err.message;
      list.appendChild(error);
    }
  }
}

customElements.define('file-list', FileList);
