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

  //A 413 from nginx itself (> 26 MB body) is an HTML page, not the API's JSON error shape.
  if (res.status === 413) {
    const data = await res.json().catch(() => null);
    const message = (data as { error?: { message: string } })?.error?.message;
    throw new Error(message ?? 'File exceeds the 25 MB limit');
  }

  await ensureOk(res);

  return res.json() as Promise<FileMeta>;
}
