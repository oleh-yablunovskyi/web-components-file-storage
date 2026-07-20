import '../components/file-list.js';
import '../components/upload-modal.js';
import '../components/file-preview.js';
import { getToken, clearToken } from '../stores/token-store.js';
import type { FileMeta } from '../api/files-api.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: var(--font-family, system-ui, sans-serif);
      padding: 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      margin: 0;
      color: var(--color-text, #111);
    }

    .user-info {
      color: var(--color-text-secondary, #555);
      font-size: 0.875rem;
    }

    button {
      padding: 0.5rem 1rem;
      background: var(--color-primary, #2563eb);
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .actions {
      margin-bottom: 1.5rem;
    }
  </style>

  <div class="header">
    <h1>File Storage</h1>
    <div>
      <span class="user-info" id="email"></span>
      <button id="logout">Logout</button>
    </div>
  </div>

  <div class="actions">
    <button id="upload">Upload</button>
  </div>

  <upload-modal id="modal"></upload-modal>
  <file-preview id="preview"></file-preview>
  <file-list id="list"></file-list>
`;

function getPayloadFromJwt(): { email: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return { email: decoded.email };
  } catch {
    return null;
  }
}

class HomePage extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    const emailEl = this.shadow.getElementById('email')!;
    const payload = getPayloadFromJwt();
    emailEl.textContent = payload?.email ?? '';

    this.shadow.getElementById('logout')!.addEventListener('click', () => {
      clearToken();
      location.reload();
    });

    const modal = this.shadow.getElementById('modal') as HTMLElement & { open(): void };
    const list = this.shadow.getElementById('list') as HTMLElement & { refresh(): void };

    this.shadow.getElementById('upload')!.addEventListener('click', () => modal.open());
    modal.addEventListener('upload-success', () => list.refresh());

    const preview = this.shadow.getElementById('preview') as HTMLElement & {
      open(file: FileMeta): void;
    };
    list.addEventListener('preview-requested', (e) => {
      preview.open((e as CustomEvent<FileMeta>).detail);
    });
  }
}

export function registerHomePage() {
  customElements.define('home-page', HomePage);
}
