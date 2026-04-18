import './pages/login-page.js';
import './pages/home-page.js';

const root = document.getElementById('root')!;

function route() {
  const hash = location.hash;
  const hasToken = localStorage.getItem('jwt') !== null;

  if (hash === '#/login' && hasToken) {
    location.hash = '#/home';
    return;
  }

  if (hash !== '#/login' && !hasToken) {
    location.hash = '#/login';
    return;
  }

  if (hash !== '#/login' && hash !== '#/home') {
    location.hash = hasToken ? '#/home' : '#/login';
    return;
  }

  root.innerHTML = '';

  if (hash === '#/home') {
    root.appendChild(document.createElement('home-page'));
  } else {
    root.appendChild(document.createElement('login-page'));
  }
}

window.addEventListener('hashchange', route);
route();
