import "../components/register-form.js";
import "../components/login-form.js";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    .card {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #ddd);
      border-radius: 8px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }

    h2 {
      margin: 0 0 1.5rem;
      color: var(--color-text, #111);
    }

    .toggle {
      margin-top: 1rem;
      text-align: center;
      font-size: 0.875rem;
    }

    .toggle a {
      color: var(--color-primary, #2563eb);
      cursor: pointer;
      text-decoration: underline;
    }
  </style>

  <div class="card">
    <h2 id="title">Log in</h2>
    <div id="form-slot"></div>
    <div class="toggle">
      <span id="toggle-text">Don't have an account? </span><a id="toggle-link">Register</a>
    </div>
  </div>
`;

class LoginPage extends HTMLElement {
  private shadow: ShadowRoot;
  private showLogin = true;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.render();

    const toggleLink = this.shadow.getElementById("toggle-link")!;
    toggleLink.addEventListener("click", () => {
      this.showLogin = !this.showLogin;
      this.render();
    });
  }

  private render() {
    const title = this.shadow.getElementById("title")!;
    const formSlot = this.shadow.getElementById("form-slot")!;
    const toggleText = this.shadow.getElementById("toggle-text")!;
    const toggleLink = this.shadow.getElementById("toggle-link")!;

    formSlot.innerHTML = "";

    if (this.showLogin) {
      title.textContent = "Log in";
      toggleText.textContent = "Don't have an account? ";
      toggleLink.textContent = "Register";
      formSlot.appendChild(document.createElement("login-form"));
    } else {
      title.textContent = "Register";
      toggleText.textContent = "Already have an account? ";
      toggleLink.textContent = "Log in";
      formSlot.appendChild(document.createElement("register-form"));
    }
  }
}

customElements.define("login-page", LoginPage);
