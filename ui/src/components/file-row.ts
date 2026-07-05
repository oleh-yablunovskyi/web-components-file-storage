import type { FileMeta } from '../api/files-api.js';

const ICONS: Record<string, string> = {
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'text/plain': '📄',
  'application/x-rar-compressed': '🗜️',
};

function iconFor(mimeType: string): string {
  return ICONS[mimeType] ?? '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
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
    }

    .meta {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
    }
  </style>

  <span class="icon" id="icon"></span>
  <span class="name" id="name"></span>
  <span class="meta" id="size"></span>
  <span class="meta" id="date"></span>
`;

class FileRow extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  set file(file: FileMeta) {
    this.shadow.getElementById('icon')!.textContent = iconFor(file.mimeType);
    this.shadow.getElementById('name')!.textContent = file.name;
    this.shadow.getElementById('size')!.textContent = formatSize(file.sizeBytes);
    this.shadow.getElementById('date')!.textContent = new Date(file.uploadedAt).toLocaleDateString();
  }
}

customElements.define('file-row', FileRow);
