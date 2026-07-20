import { request } from './http.js';

interface AuthResponse {
  user: { id: string; name: string; email: string; createdAt: string };
  token: string;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('POST', '/api/register', { name, email, password });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('POST', '/api/login', { email, password });
}
