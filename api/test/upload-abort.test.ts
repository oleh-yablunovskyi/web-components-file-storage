import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import type { Readable } from 'node:stream';
import type { User } from '../src/auth/user.interface.js';
import { FilesController } from '../src/files/files.controller.js';
import { FilesStore } from '../src/files/files.store.js';

// ---------------------------------------------------------------------------
// Minimal in-memory fakes (kept local so we don't touch files.test.ts).
// ---------------------------------------------------------------------------

class FakeFilesRepository {
  async insert(file: any) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedAt: new Date().toISOString(),
    };
  }
  async list() { return []; }
  async get() { return null; }
  async delete() { return null; }
}

class FakeObjectStore {
  onPut?: () => void;
  // Consumes the body to completion like the real store, so an abort mid-upload
  // exercises the in-flight put path.
  async put(_key: string, body: Readable): Promise<void> {
    this.onPut?.();
    for await (const _chunk of body) {
      // drain
    }
  }
  async get(): Promise<Readable> { throw new Error('unused'); }
  async delete() {}
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

// Records any unhandled rejection while active; the fix must produce none.
function trackUnhandledRejections() {
  const seen: unknown[] = [];
  const onRejection = (reason: unknown) => seen.push(reason);
  process.on('unhandledRejection', onRejection);
  return {
    stop() {
      process.removeListener('unhandledRejection', onRejection);
      return seen;
    },
  };
}

// Drives one aborted upload against a real HTTP server wrapping the real
// controller, and reports whether the handler settled (its finally ran).
async function runAbort(kind: 'before-file' | 'mid-file'): Promise<boolean> {
  const objectStore = new FakeObjectStore();
  const controller = new FilesController(
    new FilesStore(new FakeFilesRepository() as any, objectStore as any),
  );

  const handlerEntered = deferred();
  const putStarted = deferred();
  const handlerSettled = deferred();
  objectStore.onPut = () => putStarted.resolve();

  const server = http.createServer(async (req, res) => {
    handlerEntered.resolve();
    try {
      await controller.upload(req, res, { id: 'user-1' } as User);
    } catch {
      // An aborted upload rejects; that is the expected settle.
    } finally {
      handlerSettled.resolve();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as net.AddressInfo;

  const boundary = 'ABORTTEST';
  const body =
    kind === 'mid-file'
      ? `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="file"; filename="a.txt"\r\n' +
        'Content-Type: text/plain\r\n\r\n' +
        'x'.repeat(4096) // no closing boundary — we abort here
      : ''; // abort before any file part
  const request =
    'POST /api/files HTTP/1.1\r\n' +
    `Host: 127.0.0.1:${port}\r\n` +
    `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
    'Content-Length: 10000000\r\n' + // declare far more than we send
    'Connection: close\r\n\r\n';

  const sock = net.connect(port, '127.0.0.1');
  await new Promise<void>((r) => sock.once('connect', () => r()));
  sock.write(request);
  if (body) sock.write(body);

  // Abort once the controller is actually parsing (before-file) or the put is
  // in flight (mid-file), then destroy the socket without finishing the body.
  await (kind === 'mid-file' ? putStarted.promise : handlerEntered.promise);
  sock.destroy();

  const settled = await Promise.race([
    handlerSettled.promise.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
  ]);

  // Brief grace so any stray rejection surfaces before the caller checks.
  await new Promise((r) => setTimeout(r, 100));
  await new Promise<void>((r) => server.close(() => r()));
  return settled;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilesController upload — client abort', () => {
  it('settles the handler when the client aborts before the file part', async () => {
    const rejections = trackUnhandledRejections();
    const settled = await runAbort('before-file');
    const seen = rejections.stop();

    assert.equal(settled, true, 'handler should settle, not hang');
    assert.deepEqual(seen, [], 'no unhandled rejections');
  });

  it('settles the handler when the client aborts mid-file', async () => {
    const rejections = trackUnhandledRejections();
    const settled = await runAbort('mid-file');
    const seen = rejections.stop();

    assert.equal(settled, true, 'handler should settle, not hang');
    assert.deepEqual(seen, [], 'no unhandled rejections');
  });
});
