import type http from 'node:http';
import { ApiError } from './errors.js';

export function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function sendError(res: http.ServerResponse, err: unknown) {
  const isApi = err instanceof ApiError;
  const status = isApi ? err.status : (err as any)?.status ?? 500;
  const code = isApi ? err.code : (err as any)?.code ?? 'INTERNAL';
  const message = status === 500 ? 'Internal server error' : (err as Error).message;
  if (status === 500) console.error(err);
  sendJson(res, status, { error: { code, message } });
}

export function sendNotFound(res: http.ServerResponse) {
  sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
}

// Sends the name twice: `filename` as a safe-ASCII fallback for old clients,
// `filename*` percent-encoded so browsers can restore the exact name.
export function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
