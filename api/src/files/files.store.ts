import crypto from 'node:crypto';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import type { Result } from '../types/result.js';
import type { ObjectStore } from '../s3.js';
import type { FilesRepo } from './files.repository.js';
import type { FileMeta } from './file-meta.interface.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/x-rar-compressed',
]);

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export type FilesStoreError = {
  code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE';
  message: string;
};

export const TOO_LARGE_ERROR: FilesStoreError = {
  code: 'TOO_LARGE',
  message: 'File exceeds the 25 MB limit',
};

// Counts bytes as they stream through and errors the moment the limit is exceeded,
// aborting the upload; `bytes` is the final size.
class SizeLimitStream extends Transform {
  bytes = 0;

  constructor(private limit: number) {
    super();
  }

  _transform(chunk: Buffer, _encoding: string, callback: (error?: Error | null, data?: Buffer) => void): void {
    this.bytes += chunk.length;
    if (this.bytes > this.limit) {
      callback(new Error('file exceeds size limit'));
      return;
    }
    callback(null, chunk);
  }
}

export class FilesStore {
  constructor(
    private repo: FilesRepo,
    private objectStore: ObjectStore,
  ) {}

  async upload(
    userId: string,
    name: string,
    mime: string,
    stream: Readable,
  ): Promise<Result<FileMeta, FilesStoreError>> {
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      stream.resume(); // drain so the multipart parser can finish
      return { ok: false, error: { code: 'UNSUPPORTED_TYPE', message: `Unsupported file type: ${mime}` } };
    }

    // Id must be known before streaming (it's the S3 key), so generate it app-side.
    const id = crypto.randomUUID();
    const s3Key = `user/${userId}/${id}`;

    const limiter = new SizeLimitStream(MAX_FILE_BYTES);
    // Drain the source so the parser still completes once the limiter aborts.
    limiter.on('error', () => {
      if (!stream.destroyed) stream.resume();
    });
    stream.pipe(limiter);

    // Write file to S3 first
    try {
      await this.objectStore.put(s3Key, limiter, mime);
    } catch (err) {
      await this.tryDeleteObject(s3Key);
      if (limiter.bytes > MAX_FILE_BYTES) {
        return { ok: false, error: TOO_LARGE_ERROR };
      }
      throw err;
    }

    // Then write metadata to the DB
    try {
      const meta = await this.repo.insert({ id, userId, name, mimeType: mime, sizeBytes: limiter.bytes, s3Key });
      return { ok: true, value: meta };
    } catch (err) {
      await this.tryDeleteObject(s3Key); // best-effort cleanup
      throw err;
    }
  }

  async list(userId: string): Promise<FileMeta[]> {
    return this.repo.list(userId);
  }

  // Returns the owner's metadata + a readable body stream
  async getStream(userId: string, fileId: string): Promise<{ meta: FileMeta; stream: Readable } | null> {
    const file = await this.repo.get(userId, fileId);
    if (!file) return null;

    const stream = await this.objectStore.get(file.s3Key);
    const { s3Key, ...meta } = file;
    return { meta, stream };
  }

  async delete(userId: string, fileId: string): Promise<boolean> {
    const s3Key = await this.repo.delete(userId, fileId);
    if (s3Key === null) return false;

    await this.tryDeleteObject(s3Key);
    return true;
  }

  private async tryDeleteObject(key: string): Promise<void> {
    try {
      await this.objectStore.delete(key);
    } catch (err) {
      console.error(`[files] failed to delete object ${key}:`, (err as Error).message);
    }
  }
}
