import { S3Client, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import { config } from './config.js';

export const bucket = config.s3Bucket;

export const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
});

export interface ObjectStore {
  put(key: string, body: Readable, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class S3ObjectStore implements ObjectStore {
  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}

  // Multipart Upload streams a body of unknown length (a single PutObject needs the length up front);
  // on a body error it aborts, committing nothing.
  async put(key: string, body: Readable, contentType: string): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
    });
    await upload.done();
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

// Wait until the object store is ready (it may still be provisioning on boot).
export async function waitForObjectStore(): Promise<void> {
  const maxAttempts = 30;
  const baseDelayMs = 500;
  const maxDelayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log('[s3] object store reachable');
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error('[s3] object store unreachable after retries:', (err as Error).message);
        process.exit(1);
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      console.log(`[s3] object store not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
