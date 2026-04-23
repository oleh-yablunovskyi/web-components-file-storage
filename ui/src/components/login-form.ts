import { login } from '../api.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }

    label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
      color: var(--color-text, #111);
    }

    input {
      display: block;
      width: 100%;
      padding: 0.5rem;
      margin-bottom: 1rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }

    button {
      width: 100%;
      padding: 0.625rem;
      background: var(--color-primary, #2563eb);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error {
      color: var(--color-error, #dc2626);
      font-size: 0.875rem;
      margin: 0 0 1rem;
    }
  </style>

  <form id="form">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email" />

    <label for="password">Password</label>
    <input id="password" name="password" type="password" required
      minlength="8" maxlength="100" autocomplete="current-password" />

    <p class="error" id="error" hidden></p>
    <button type="submit">Log in</button>
  </form>
`;

class LoginForm extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    const form = this.shadow.getElementById('form') as HTMLFormElement;
    const errorEl = this.shadow.getElementById('error') as HTMLParagraphElement;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;

      const email = (this.shadow.getElementById('email') as HTMLInputElement).value;
      const password = (this.shadow.getElementById('password') as HTMLInputElement).value;

      const btn = form.querySelector('button') as HTMLButtonElement;
      btn.disabled = true;

      try {
        const { token } = await login(email, password);
        localStorage.setItem('jwt', token);
        location.hash = '#/home';
      } catch (err: any) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }
}

customElements.define('login-form', LoginForm);
