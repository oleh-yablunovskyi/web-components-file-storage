import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

export const bucket = config.s3Bucket;

export const s3 = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
});

// Wait until the object store is ready (it may still be provisioning on boot).
export async function waitForObjectStore(): Promise<void> {
  const maxAttempts = 30;
  const baseDelayMs = 500;
  const maxDelayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
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
