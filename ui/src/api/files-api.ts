import { request, getAuthHeaders, ensureOk, logoutIfUnauthorized } from './http.js';

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export async function listFiles(): Promise<FileMeta[]> {
  return request<FileMeta[]>('GET', '/api/files');
}

export async function uploadFile(file: File): Promise<FileMeta> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/files', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  logoutIfUnauthorized(res);
  await ensureOk(res);

  return res.json() as Promise<FileMeta>;
}
