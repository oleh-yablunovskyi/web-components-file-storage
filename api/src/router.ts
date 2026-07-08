import type http from 'node:http';
import { sendNotFound } from './utils.js';

type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ParamRoute {
  method: string;
  regex: RegExp;
  handler: RouteHandler;
}

export class Router {
  private staticRoutes = new Map<string, RouteHandler>();
  private paramRoutes: ParamRoute[] = [];

  get(path: string, handler: RouteHandler): void {
    this.add('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.add('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.add('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.add('DELETE', path, handler);
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? '';

    const staticHandler = this.staticRoutes.get(this.key(method, url.pathname));
    if (staticHandler) {
      await staticHandler(req, res, {});
      return;
    }

    for (const route of this.paramRoutes) {
      if (route.method !== method) continue;
      const match = route.regex.exec(url.pathname);
      if (!match) continue;

      await route.handler(req, res, match.groups ?? {});
      return;
    }

    sendNotFound(res);
  }

  private add(method: HttpMethod, path: string, handler: RouteHandler): void {
    if (path.includes(':')) {
      const pattern = path.replace(/:([^/]+)/g, (_full, name) => `(?<${name}>[^/]+)`);
      this.paramRoutes.push({ method, regex: new RegExp(`^${pattern}$`), handler });
      return;
    }

    const key = this.key(method, path);
    if (this.staticRoutes.has(key)) {
      throw new Error(`Route already registered: ${key}`);
    }

    this.staticRoutes.set(key, handler);
  }

  private key(method: string | undefined, path: string): string {
    return `${method ?? ''} ${path}`;
  }
}
