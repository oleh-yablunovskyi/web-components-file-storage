import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AuthService } from '../src/auth/auth.service.js';
import type { UserRow, User } from '../src/auth/auth.repository.js';
import { ApiError } from '../src/errors.js';

// ---------------------------------------------------------------------------
// In-memory fake repo
// ---------------------------------------------------------------------------

class FakeAuthRepository {
  private rows = new Map<string, UserRow>();

  async findByEmail(email: string): Promise<UserRow | null> {
    for (const row of this.rows.values()) {
      if (row.email === email) return row;
    }
    return null;
  }

  async insert(name: string, email: string, passwordHash: string): Promise<User> {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const row: UserRow = { id, name, email, password_hash: passwordHash, created_at };
    this.rows.set(id, row);
    return { id, name, email, created_at };
  }

  async findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
  }
}

const expectApiError = (code: string, status: number) => (err: any) => {
  assert.ok(err instanceof ApiError);
  assert.equal(err.code, code);
  assert.equal(err.status, status);
  return true;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let repo: FakeAuthRepository;
  let service: AuthService;

  before(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    repo = new FakeAuthRepository();
    service = new AuthService(repo as any);
  });

  // -- register -------------------------------------------------------------

  describe('register', () => {
    it('returns user and token on success', async () => {
      const result = await service.register('Alice', 'alice@test.com', 'password123');

      assert.equal(result.user.name, 'Alice');
      assert.equal(result.user.email, 'alice@test.com');
      assert.ok(result.user.id, 'user should have an id');
      assert.ok(result.user.created_at, 'user should have created_at');
      assert.ok(result.token, 'should return a token');
      assert.equal((result.user as any).password_hash, undefined, 'user must not expose password_hash');
    });

    it('stores a bcrypt hash, not plaintext', async () => {
      await service.register('Alice', 'alice@test.com', 'password123');

      const stored = await repo.findByEmail('alice@test.com');
      assert.ok(stored, 'row should be stored');
      assert.match(stored!.password_hash, /^\$2[ab]\$/, 'hash should be bcrypt');
      assert.notEqual(stored!.password_hash, 'password123', 'must not store plaintext');
    });

    it('throws EMAIL_TAKEN on duplicate email', async () => {
      await service.register('Alice', 'alice@test.com', 'password123');

      await assert.rejects(
        () => service.register('Bob', 'alice@test.com', 'password456'),
        expectApiError('EMAIL_TAKEN', 409),
      );
    });

    it('throws INVALID_PASSWORD when password is too short', async () => {
      await assert.rejects(
        () => service.register('Alice', 'alice@test.com', 'short'),
        expectApiError('INVALID_PASSWORD', 400),
      );
    });

    it('throws INVALID_PASSWORD when password is too long', async () => {
      await assert.rejects(
        () => service.register('Alice', 'alice@test.com', 'x'.repeat(101)),
        expectApiError('INVALID_PASSWORD', 400),
      );
    });
  });

  // -- login ----------------------------------------------------------------

  describe('login', () => {
    beforeEach(async () => {
      await service.register('Alice', 'alice@test.com', 'password123');
    });

    it('returns user and token on success', async () => {
      const result = await service.login('alice@test.com', 'password123');

      assert.equal(result.user.email, 'alice@test.com');
      assert.equal(result.user.name, 'Alice');
      assert.ok(result.token, 'should return a token');
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      await assert.rejects(
        () => service.login('alice@test.com', 'wrongpassword'),
        expectApiError('INVALID_CREDENTIALS', 401),
      );
    });

    it('throws INVALID_CREDENTIALS on unknown email', async () => {
      await assert.rejects(
        () => service.login('nobody@test.com', 'password123'),
        expectApiError('INVALID_CREDENTIALS', 401),
      );
    });

    it('throws the same error for wrong password and unknown email', async () => {
      const errors: ApiError[] = [];

      try { await service.login('alice@test.com', 'wrongpassword'); }
      catch (e) { errors.push(e as ApiError); }

      try { await service.login('nobody@test.com', 'password123'); }
      catch (e) { errors.push(e as ApiError); }

      assert.equal(errors.length, 2);
      assert.equal(errors[0].code, errors[1].code, 'error codes must match');
      assert.equal(errors[0].status, errors[1].status, 'status codes must match');
      assert.equal(errors[0].message, errors[1].message, 'messages must match');
    });
  });

  // -- verifyToken ----------------------------------------------------------

  describe('verifyToken', () => {
    it('returns the user for a valid token', async () => {
      const { token } = await service.register('Alice', 'alice@test.com', 'password123');

      const user = await service.verifyToken(token);

      assert.ok(user, 'should return a user');
      assert.equal(user!.email, 'alice@test.com');
      assert.equal(user!.name, 'Alice');
    });

    it('returns null for an invalid token', async () => {
      const user = await service.verifyToken('not-a-real-token');
      assert.equal(user, null);
    });

    it('returns null for a tampered token', async () => {
      const { token } = await service.register('Alice', 'alice@test.com', 'password123');
      const tampered = token.slice(0, -5) + 'XXXXX';

      const user = await service.verifyToken(tampered);
      assert.equal(user, null);
    });
  });
});
