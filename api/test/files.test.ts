import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { FilesStore, MAX_FILE_BYTES } from '../src/files/files.store.js';
import type { FilesStoreError } from '../src/files/files.store.js';
import type { FileInsert, FilesRepo } from '../src/files/files.repository.js';
import type { ObjectStore } from '../src/s3.js';
import type { FileMeta } from '../src/files/file-meta.interface.js';
import type { Result } from '../src/types/result.js';

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

interface FileRecord extends FileInsert {
  uploadedAt: string;
}

class FakeFilesRepository implements FilesRepo {
  rows = new Map<string, FileRecord>();
  failNextInsert = false;
  private seq = 0;

  async insert(file: FileInsert): Promise<FileMeta> {
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error('insert failed');
    }
    // Monotonic timestamps so newest-first ordering is deterministic.
    const uploadedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, this.seq++)).toISOString();
    this.rows.set(file.id, { ...file, uploadedAt });
    return { id: file.id, name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes, uploadedAt };
  }

  async list(userId: string): Promise<FileMeta[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map((r) => ({ id: r.id, name: r.name, mimeType: r.mimeType, sizeBytes: r.sizeBytes, uploadedAt: r.uploadedAt }));
  }
}

class FakeObjectStore implements ObjectStore {
  objects = new Map<string, { content: Buffer; contentType: string }>();
  failNextPut = false;

  async put(key: string, body: Readable, contentType: string): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('put failed');
    }
    const chunks: Buffer[] = [];
    // Throws if the body errors (e.g. the size-limit guard tripping), mirroring
    // a real aborted upload that commits nothing.
    for await (const chunk of body) chunks.push(chunk as Buffer);
    this.objects.set(key, { content: Buffer.concat(chunks), contentType });
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

function streamOf(content: string | Buffer): Readable {
  return Readable.from([Buffer.from(content)]);
}

// Streams just over the limit without allocating it all at once.
function oversizedStream(): Readable {
  const chunk = Buffer.alloc(1024 * 1024); // 1 MB
  let sent = 0;
  return new Readable({
    read() {
      if (sent > MAX_FILE_BYTES) {
        this.push(null);
        return;
      }
      sent += chunk.length;
      this.push(chunk);
    },
  });
}

function expectSuccess(result: Result<FileMeta, FilesStoreError>): FileMeta {
  if (!result.ok) {
    assert.fail(`expected success, got ${result.error.code}`);
  }
  return result.value;
}

function expectError(result: Result<FileMeta, FilesStoreError>, code: FilesStoreError['code']): void {
  if (result.ok) {
    assert.fail('expected error, got success');
  }
  assert.equal(result.error.code, code);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilesStore', () => {
  let repo: FakeFilesRepository;
  let objectStore: FakeObjectStore;
  let store: FilesStore;

  beforeEach(() => {
    repo = new FakeFilesRepository();
    objectStore = new FakeObjectStore();
    store = new FilesStore(repo, objectStore);
  });

  describe('upload', () => {
    it('writes both stores and returns metadata', async () => {
      const meta = expectSuccess(await store.upload('user-1', 'hello.txt', 'text/plain', streamOf('hello')));

      assert.ok(meta.id, 'should have an id');
      assert.equal(meta.name, 'hello.txt');
      assert.equal(meta.mimeType, 'text/plain');
      assert.equal(meta.sizeBytes, 5);
      assert.ok(meta.uploadedAt, 'should have uploadedAt');

      // S3 object written at the user-scoped key with the streamed bytes.
      const stored = objectStore.objects.get(`user/user-1/${meta.id}`);
      assert.ok(stored, 'object should be written');
      assert.equal(stored!.content.toString(), 'hello');
      assert.equal(stored!.contentType, 'text/plain');

      // DB row written, keyed by the same app-generated id.
      assert.equal(repo.rows.size, 1);
      assert.ok(repo.rows.has(meta.id), 'row should use the app-generated id');
    });

    it('rejects a disallowed mime type, writing neither store', async () => {
      const result = await store.upload('user-1', 'evil.exe', 'application/x-msdownload', streamOf('data'));

      expectError(result, 'UNSUPPORTED_TYPE');
      assert.equal(objectStore.objects.size, 0, 'nothing should be written to S3');
      assert.equal(repo.rows.size, 0, 'nothing should be written to the DB');
    });

    it('rejects an oversized upload, writing neither store', async () => {
      const result = await store.upload('user-1', 'big.png', 'image/png', oversizedStream());

      expectError(result, 'TOO_LARGE');
      assert.equal(objectStore.objects.size, 0, 'nothing should be committed to S3');
      assert.equal(repo.rows.size, 0, 'nothing should be written to the DB');
    });

    it('deletes the S3 object when the DB insert fails (no orphan)', async () => {
      repo.failNextInsert = true;

      await assert.rejects(store.upload('user-1', 'hello.txt', 'text/plain', streamOf('hello')));

      assert.equal(objectStore.objects.size, 0, 'orphaned object should be cleaned up');
      assert.equal(repo.rows.size, 0, 'no row should remain');
    });

    it('propagates an object-store failure without writing a DB row', async () => {
      objectStore.failNextPut = true;

      await assert.rejects(store.upload('user-1', 'hello.txt', 'text/plain', streamOf('hello')));

      assert.equal(objectStore.objects.size, 0, 'nothing should be committed to S3');
      assert.equal(repo.rows.size, 0, 'no row should be written');
    });

  });

  describe('list', () => {
    it("returns only the caller's files, newest-first", async () => {
      const first = expectSuccess(await store.upload('user-1', 'a.txt', 'text/plain', streamOf('a')));
      const second = expectSuccess(await store.upload('user-1', 'b.txt', 'text/plain', streamOf('b')));
      expectSuccess(await store.upload('user-2', 'c.txt', 'text/plain', streamOf('c')));

      const listed = await store.list('user-1');

      assert.deepEqual(
        listed.map((f) => f.id),
        [second.id, first.id],
        'should be newest-first and scoped to user-1',
      );
    });

    it('returns an empty list for a user with no files', async () => {
      expectSuccess(await store.upload('user-1', 'a.txt', 'text/plain', streamOf('a')));

      const listed = await store.list('user-2');

      assert.deepEqual(listed, []);
    });
  });
});
