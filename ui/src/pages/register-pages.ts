import { registerHomePage } from './home-page.js';
import { registerLoginPage } from './login-page.js';

export function registerPages() {
  registerLoginPage();
  registerHomePage();
}
