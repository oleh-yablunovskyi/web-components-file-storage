import { downloadFile } from '../api/files-api.js';
import type { FileMeta } from '../api/files-api.js';
import { formatSize } from '../utils/format-utils.js';

type PreviewKind = 'image' | 'text' | 'none';

function previewKind(mimeType: string): PreviewKind {
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') return 'image';
  if (mimeType === 'text/plain') return 'text';
  return 'none';
}

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }

    /* Author display rules below (flex/block) would otherwise beat the User Agent's [hidden] { display: none }. */
    [hidden] {
      display: none !important;
    }

    dialog {
      border: 1px solid var(--color-border, #ddd);
      border-radius: 8px;
      padding: 2rem;
      width: 100%;
      max-width: 640px;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }

    h2 {
      margin: 0 0 1.5rem;
      color: var(--color-text, #111);
      font-size: 1.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    img {
      display: block;
      max-width: 100%;
      max-height: 60vh;
      margin: 0 auto;
    }

    pre {
      margin: 0;
      padding: 0.75rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      max-height: 60vh;
      overflow: auto;
      color: var(--color-text, #111);
      font-size: 0.875rem;
    }

    .generic {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .generic .icon {
      font-size: 3rem;
    }

    .generic .name {
      color: var(--color-text, #111);
    }

    .generic .meta,
    .message {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
    }

    .message {
      margin: 0;
    }

    .error {
      color: var(--color-error, #dc2626);
      font-size: 0.875rem;
      margin: 0;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .close {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #111);
      font-size: 1rem;
      cursor: pointer;
    }
  </style>

  <dialog id="dialog">
    <h2 id="title"></h2>
    <p class="message" id="loading" hidden>Loading…</p>
    <p class="error" id="error" hidden></p>
    <img id="image" alt="" hidden />
    <pre id="text" hidden></pre>
    <div class="generic" id="generic" hidden>
      <span class="icon">📦</span>
      <div>
        <div class="name" id="generic-name"></div>
        <div class="meta" id="generic-meta"></div>
      </div>
    </div>
    <div class="actions">
      <button class="close" id="close">Close</button>
    </div>
  </dialog>
`;

class FilePreview extends HTMLElement {
  private shadow: ShadowRoot;
  private objectUrl: string | null = null;
  // Incremented on every open(); guards a stale fetch from touching a newer preview.
  private openCount = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));

    const dialog = this.shadow.getElementById('dialog') as HTMLDialogElement;
    this.shadow.getElementById('close')!.addEventListener('click', () => dialog.close());
    // Fires for both the Close button and Esc.
    dialog.addEventListener('close', () => this.releaseObjectUrl());
  }

  async open(file: FileMeta) {
    const count = ++this.openCount;

    const dialog = this.shadow.getElementById('dialog') as HTMLDialogElement;
    const loading = this.shadow.getElementById('loading')!;
    const errorEl = this.shadow.getElementById('error')!;
    const img = this.shadow.getElementById('image') as HTMLImageElement;
    const text = this.shadow.getElementById('text') as HTMLPreElement;
    const generic = this.shadow.getElementById('generic')!;

    loading.hidden = true;
    errorEl.hidden = true;
    img.hidden = true;
    img.removeAttribute('src');
    text.hidden = true;
    text.textContent = '';
    generic.hidden = true;

    this.shadow.getElementById('title')!.textContent = file.name;
    dialog.showModal();

    const kind = previewKind(file.mimeType);

    if (kind === 'none') {
      this.shadow.getElementById('generic-name')!.textContent = file.name;
      this.shadow.getElementById('generic-meta')!.textContent =
        `${file.mimeType} · ${formatSize(file.sizeBytes)}`;
      generic.hidden = false;
      return;
    }

    loading.hidden = false;

    try {
      const blob = await downloadFile(file.id);
      if (count !== this.openCount || !dialog.open) return;

      if (kind === 'image') {
        this.objectUrl = URL.createObjectURL(blob);
        img.src = this.objectUrl;
        img.alt = file.name;
        img.hidden = false;
      } else {
        const contents = await blob.text();
        if (count !== this.openCount || !dialog.open) return;
        text.textContent = contents;
        text.hidden = false;
      }
    } catch (err: any) {
      if (count !== this.openCount || !dialog.open) return;
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      if (count === this.openCount) loading.hidden = true;
    }
  }

  private releaseObjectUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

customElements.define('file-preview', FilePreview);
