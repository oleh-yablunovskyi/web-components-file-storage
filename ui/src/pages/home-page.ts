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
  </style>

  <div class="header">
    <h1>File Storage</h1>
    <div>
      <span class="user-info" id="email"></span>
      <button id="logout">Logout</button>
    </div>
  </div>
  <p>Home page</p>
`;

function getEmailFromJwt(): string | null {
  const token = localStorage.getItem('jwt');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.email ?? null;
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
    emailEl.textContent = getEmailFromJwt() ?? '';

    this.shadow.getElementById('logout')!.addEventListener('click', () => {
      localStorage.removeItem('jwt');
      location.hash = '';
      location.reload();
    });
  }
}

customElements.define('home-page', HomePage);
