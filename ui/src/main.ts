import { registerPages } from './pages/register-pages.js';
import { getToken } from './stores/token-store.js';

registerPages();

interface AppRoute {
  hash: string;
  tagName: string;
  access: 'guest' | 'authenticated';
}

const defaultHash = {
  authenticated: '#/home',
  unauthenticated: '#/login',
};

const routes: AppRoute[] = [
  {
    hash: defaultHash.unauthenticated,
    tagName: 'login-page',
    access: 'guest',
  },
  {
    hash: defaultHash.authenticated,
    tagName: 'home-page',
    access: 'authenticated',
  },
];

const root = document.getElementById('root')!;

function findRoute(hash: string) {
  return routes.find((route) => route.hash === hash);
}

function route() {
  const hasToken = getToken() !== null;
  const currentRoute = findRoute(location.hash);

  if (!currentRoute) {
    location.hash = hasToken
      ? defaultHash.authenticated
      : defaultHash.unauthenticated;
    return;
  }

  if (currentRoute.access === 'authenticated' && !hasToken) {
    location.hash = defaultHash.unauthenticated;
    return;
  }

  if (currentRoute.access === 'guest' && hasToken) {
    location.hash = defaultHash.authenticated;
    return;
  }

  root.innerHTML = '';
  root.appendChild(document.createElement(currentRoute.tagName));
}

window.addEventListener('hashchange', route);
route();
