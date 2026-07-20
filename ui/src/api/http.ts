import { getToken, clearToken } from '../stores/token-store.js';

interface ApiError {
  code: string;
  message: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logoutIfUnauthorized(res: Response): void {
  // A 401 with no stored session (e.g. a failed login) is not a session expiry.
  if (res.status !== 401 || getToken() === null) return;
  clearToken();
  location.reload();
  // reload() doesn't halt execution, so throw to stop the caller from proceeding.
  throw new Error('Session expired');
}

export async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = (data as { error?: ApiError })?.error;
    throw new Error(err?.message ?? `Request failed (${res.status})`);
  }
}

export async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers = getAuthHeaders();

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  logoutIfUnauthorized(res);
  await ensureOk(res);

  return res.json() as Promise<T>;
}
