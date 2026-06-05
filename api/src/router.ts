import type http from 'node:http';

type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void | Promise<void>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class Router {
  private routes = new Map<string, RouteHandler>();

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
    const handler = this.routes.get(this.key(req.method, url.pathname));

    if (!handler) {
      res.writeHead(404);
      res.end();
      return;
    }

    await handler(req, res);
  }

  private add(method: HttpMethod, path: string, handler: RouteHandler): void {
    const key = this.key(method, path);
    if (this.routes.has(key)) {
      throw new Error(`Route already registered: ${key}`);
    }

    this.routes.set(key, handler);
  }

  private key(method: string | undefined, path: string): string {
    return `${method ?? ''} ${path}`;
  }
}
