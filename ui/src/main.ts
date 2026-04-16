import './pages/login-page.js';
import './pages/home-page.js';

const root = document.getElementById('root')!;

function route() {
  const hash = location.hash;
  root.innerHTML = '';

  if (hash === '#/home') {
    root.appendChild(document.createElement('home-page'));
  } else {
    root.appendChild(document.createElement('login-page'));
  }
}

window.addEventListener('hashchange', route);
route();
