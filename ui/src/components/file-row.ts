import { downloadFile, deleteFile } from '../api/files-api.js';
import type { FileMeta } from '../api/files-api.js';
import { formatSize } from '../utils/format-utils.js';

const ICONS: Record<string, string> = {
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'text/plain': '📄',
  'application/x-rar-compressed': '📦',
};

function iconFor(mimeType: string): string {
  return ICONS[mimeType] ?? '📄';
}

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    .icon {
      font-size: 1.5rem;
    }

    .name {
      flex: 1;
      color: var(--color-text, #111);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    .name:hover {
      text-decoration: underline;
    }

    .meta {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
    }

    button {
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #111);
      font-size: 0.875rem;
      cursor: pointer;
    }

    button.delete {
      color: var(--color-error, #dc2626);
    }
  </style>

  <span class="icon" id="icon"></span>
  <span class="name" id="name"></span>
  <span class="meta" id="size"></span>
  <span class="meta" id="date"></span>
  <button id="download">Download</button>
  <button class="delete" id="delete">Delete</button>
`;

class FileRow extends HTMLElement {
  private shadow: ShadowRoot;
  private meta?: FileMeta;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));

    this.shadow.getElementById('name')!.addEventListener('click', () => this.onPreview());
    this.shadow.getElementById('download')!.addEventListener('click', () => this.onDownload());
    this.shadow.getElementById('delete')!.addEventListener('click', () => this.onDelete());
  }

  set file(file: FileMeta) {
    this.meta = file;
    this.shadow.getElementById('icon')!.textContent = iconFor(file.mimeType);
    this.shadow.getElementById('name')!.textContent = file.name;
    this.shadow.getElementById('size')!.textContent = formatSize(file.sizeBytes);
    this.shadow.getElementById('date')!.textContent = new Date(file.uploadedAt).toLocaleDateString();
  }

  private onPreview() {
    if (!this.meta) return;
    this.dispatchEvent(
      new CustomEvent<FileMeta>('preview-requested', {
        detail: this.meta,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async onDownload() {
    if (!this.meta) return;
    try {
      const blob = await downloadFile(this.meta.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.meta.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  }

  private async onDelete() {
    if (!this.meta) return;
    if (!confirm(`Delete "${this.meta.name}"?`)) return;
    try {
      await deleteFile(this.meta.id);
      this.dispatchEvent(new CustomEvent('file-deleted', { bubbles: true, composed: true }));
    } catch (err: any) {
      alert(err.message);
    }
  }
}

customElements.define('file-row', FileRow);
