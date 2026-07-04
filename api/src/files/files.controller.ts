import type http from 'node:http';
import busboy from 'busboy';
import type { User } from '../auth/user.interface.js';
import { ApiError } from '../errors.js';
import { sendJson } from '../utils.js';
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

    const result = await this.parse(req, user.id);
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

  private parse(req: http.IncomingMessage, userId: string): Promise<Result<FileMeta, FilesStoreError>> {
    return new Promise((resolve, reject) => {
      let bb: busboy.Busboy;

      try {
        bb = busboy({ headers: req.headers, limits: { files: 1 } });
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
