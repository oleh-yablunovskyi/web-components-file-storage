import type http from 'node:http';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import type { User } from '../auth/user.interface.js';
import { ApiError } from '../errors.js';
import { contentDisposition, sendJson, sendNotFound } from '../utils.js';
import type { Result } from '../types/result.js';
import { FilesStore, MAX_FILE_BYTES, TOO_LARGE_ERROR } from './files.store.js';
import type { FilesStoreError } from './files.store.js';
import type { FileMeta } from './file-meta.interface.js';

const FILE_ERROR_STATUS: Record<FilesStoreError['code'], number> = {
  UNSUPPORTED_TYPE: 400,
  TOO_LARGE: 413,
};

export class FilesController {
  constructor(private filesStore: FilesStore) {}

  async upload(req: http.IncomingMessage, res: http.ServerResponse, user: User) {
    // Cheap early reject; the envelope inflates this, so FilesStore's byte counter is authoritative.
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (contentLength > MAX_FILE_BYTES) {
      sendJson(res, FILE_ERROR_STATUS[TOO_LARGE_ERROR.code], { error: TOO_LARGE_ERROR });
      return;
    }

    const result = await this.parseAndStore(req, user.id);
    if (!result.ok) {
      sendJson(res, FILE_ERROR_STATUS[result.error.code], { error: result.error });
      return;
    }

    sendJson(res, 201, result.value);
  }

  async list(_req: http.IncomingMessage, res: http.ServerResponse, user: User) {
    const files = await this.filesStore.list(user.id);
    sendJson(res, 200, files);
  }

  async download(_req: http.IncomingMessage, res: http.ServerResponse, user: User, id: string) {
    const file = await this.filesStore.getStream(user.id, id);
    if (!file) {
      sendNotFound(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': file.meta.mimeType,
      'Content-Disposition': contentDisposition(file.meta.name),
    });

    // Stream straight through with no buffering; on a mid-stream error `pipeline`
    // tears down both streams, so headers are already sent — just log it.
    try {
      await pipeline(file.stream, res);
    } catch (err) {
      console.error('[files] download stream failed:', (err as Error).message);
    }
  }

  async delete(_req: http.IncomingMessage, res: http.ServerResponse, user: User, id: string) {
    const deleted = await this.filesStore.delete(user.id, id);
    if (!deleted) {
      sendNotFound(res);
      return;
    }

    sendJson(res, 200, { success: true });
  }

  private parseAndStore(req: http.IncomingMessage, userId: string): Promise<Result<FileMeta, FilesStoreError>> {
    return new Promise((resolve, reject) => {
      let bb: busboy.Busboy;

      try {
        // defParamCharset: browsers send filenames as raw UTF-8 bytes, while busboy's
        // default is latin1, which would mess up any non-ASCII name.
        bb = busboy({ headers: req.headers, limits: { files: 1 }, defParamCharset: 'utf8' });
      } catch {
        reject(new ApiError(400, 'INVALID_UPLOAD', 'Invalid multipart request'));
        return;
      }

      let pendingUpload: Promise<Result<FileMeta, FilesStoreError>> | null = null;

      bb.on('file', (_field, stream, info) => {
        pendingUpload = this.filesStore.upload(userId, info.filename, info.mimeType, stream);
      });
      bb.on('error', reject);
      bb.on('close', async () => {
        if (!pendingUpload) {
          reject(new ApiError(400, 'NO_FILE', 'No file provided'));
          return;
        }
        try {
          resolve(await pendingUpload);
        } catch (err) {
          reject(err);
        }
      });

      req.pipe(bb);
    });
  }
}
