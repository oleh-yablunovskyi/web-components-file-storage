interface ApiError {
  code: string;
  message: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('jwt');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('jwt');
    location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = (data as { error?: ApiError })?.error;
    throw new Error(err?.message ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

interface RegisterResponse {
  user: { id: string; name: string; email: string; created_at: string };
  token: string;
}

export async function register(name: string, email: string, password: string): Promise<RegisterResponse> {
  return request<RegisterResponse>('POST', '/api/register', { name, email, password });
}
