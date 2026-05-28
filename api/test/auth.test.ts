import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type http from 'node:http';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import type { AuthServiceError, AuthSession } from '../src/auth/auth.service.js';
import type { UserRow, User } from '../src/auth/auth.repository.js';
import type { Result } from '../src/types/result.js';

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

type TestResponse = http.ServerResponse & {
  body?: string;
  writtenHeaders?: http.OutgoingHttpHeaders;
  writtenStatus?: number;
};

function expectSuccess(result: Result<AuthSession, AuthServiceError>): AuthSession {
  if (!result.ok) {
    assert.fail(`expected success, got ${result.error.code}`);
  }

  return result.value;
}

function expectAuthError(
  result: Result<AuthSession, AuthServiceError>,
  code: AuthServiceError['code'],
  message?: string,
): AuthServiceError {
  if (result.ok) {
    assert.fail('expected auth error, got success');
  }

  assert.equal(result.error.code, code);
  if (message) {
    assert.equal(result.error.message, message);
  }

  return result.error;
}

function createJsonRequest(body: unknown): http.IncomingMessage {
  return Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as http.IncomingMessage;
}

function createResponse(): TestResponse {
  const response = {
    writeHead(statusCode: number, headers?: http.OutgoingHttpHeaders) {
      response.writtenStatus = statusCode;
      response.writtenHeaders = headers;
      return response;
    },
    end(chunk?: unknown) {
      response.body = chunk?.toString() ?? '';
      return response;
    },
  } as TestResponse;

  return response;
}

function readResponseJson(response: TestResponse): any {
  assert.ok(response.body, 'response should have a body');
  return JSON.parse(response.body);
}

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
      const result = expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));

      assert.equal(result.user.name, 'Alice');
      assert.equal(result.user.email, 'alice@test.com');
      assert.ok(result.user.id, 'user should have an id');
      assert.ok(result.user.created_at, 'user should have created_at');
      assert.ok(result.token, 'should return a token');
      assert.equal((result.user as any).password_hash, undefined, 'user must not expose password_hash');
    });

    it('stores a bcrypt hash, not plaintext', async () => {
      expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));

      const stored = await repo.findByEmail('alice@test.com');
      assert.ok(stored, 'row should be stored');
      assert.match(stored!.password_hash, /^\$2[ab]\$/, 'hash should be bcrypt');
      assert.notEqual(stored!.password_hash, 'password123', 'must not store plaintext');
    });

    it('returns EMAIL_TAKEN on duplicate email', async () => {
      expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));

      const result = await service.register('Bob', 'alice@test.com', 'password456');

      expectAuthError(result, 'EMAIL_TAKEN', 'Email is already registered');
    });

    it('returns INVALID_PASSWORD when password is too short', async () => {
      const result = await service.register('Alice', 'alice@test.com', 'short');

      expectAuthError(result, 'INVALID_PASSWORD', 'Password must be 8\u2013100 characters');
    });

    it('returns INVALID_PASSWORD when password is too long', async () => {
      const result = await service.register('Alice', 'alice@test.com', 'x'.repeat(101));

      expectAuthError(result, 'INVALID_PASSWORD', 'Password must be 8\u2013100 characters');
    });
  });

  // -- login ----------------------------------------------------------------

  describe('login', () => {
    beforeEach(async () => {
      expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));
    });

    it('returns user and token on success', async () => {
      const result = expectSuccess(await service.login('alice@test.com', 'password123'));

      assert.equal(result.user.email, 'alice@test.com');
      assert.equal(result.user.name, 'Alice');
      assert.ok(result.token, 'should return a token');
    });

    it('returns INVALID_CREDENTIALS on wrong password', async () => {
      const result = await service.login('alice@test.com', 'wrongpassword');

      expectAuthError(result, 'INVALID_CREDENTIALS', 'Invalid email or password');
    });

    it('returns INVALID_CREDENTIALS on unknown email', async () => {
      const result = await service.login('nobody@test.com', 'password123');

      expectAuthError(result, 'INVALID_CREDENTIALS', 'Invalid email or password');
    });

    it('returns the same error for wrong password and unknown email', async () => {
      const wrongPassword = expectAuthError(
        await service.login('alice@test.com', 'wrongpassword'),
        'INVALID_CREDENTIALS',
      );
      const unknownEmail = expectAuthError(
        await service.login('nobody@test.com', 'password123'),
        'INVALID_CREDENTIALS',
      );

      assert.equal(wrongPassword.code, unknownEmail.code, 'error codes must match');
      assert.equal(wrongPassword.message, unknownEmail.message, 'messages must match');
    });
  });

  // -- verifyToken ----------------------------------------------------------

  describe('verifyToken', () => {
    it('returns the user for a valid token', async () => {
      const { token } = expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));

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
      const { token } = expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));
      const tampered = token.slice(0, -5) + 'XXXXX';

      const user = await service.verifyToken(tampered);
      assert.equal(user, null);
    });
  });
});

describe('AuthController', () => {
  let repo: FakeAuthRepository;
  let service: AuthService;
  let controller: AuthController;

  before(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    repo = new FakeAuthRepository();
    service = new AuthService(repo as any);
    controller = new AuthController(service);
  });

  it('unwraps register success responses', async () => {
    const req = createJsonRequest({ name: 'Alice', email: 'alice@test.com', password: 'password123' });
    const res = createResponse();

    await controller.register(req, res);

    const body = readResponseJson(res);
    assert.equal(res.writtenStatus, 201);
    assert.equal(body.user.email, 'alice@test.com');
    assert.ok(body.token, 'should return a token');
    assert.equal(body.ok, undefined);
    assert.equal(body.value, undefined);
  });

  it('unwraps login success responses', async () => {
    expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));
    const req = createJsonRequest({ email: 'alice@test.com', password: 'password123' });
    const res = createResponse();

    await controller.login(req, res);

    const body = readResponseJson(res);
    assert.equal(res.writtenStatus, 200);
    assert.equal(body.user.email, 'alice@test.com');
    assert.ok(body.token, 'should return a token');
    assert.equal(body.ok, undefined);
    assert.equal(body.value, undefined);
  });

  it('maps invalid register passwords to 400', async () => {
    const req = createJsonRequest({ name: 'Alice', email: 'alice@test.com', password: 'short' });
    const res = createResponse();

    await controller.register(req, res);

    const body = readResponseJson(res);
    assert.equal(res.writtenStatus, 400);
    assert.deepEqual(body, {
      error: { code: 'INVALID_PASSWORD', message: 'Password must be 8\u2013100 characters' },
    });
  });

  it('maps duplicate register emails to 409', async () => {
    expectSuccess(await service.register('Alice', 'alice@test.com', 'password123'));
    const req = createJsonRequest({ name: 'Bob', email: 'alice@test.com', password: 'password456' });
    const res = createResponse();

    await controller.register(req, res);

    const body = readResponseJson(res);
    assert.equal(res.writtenStatus, 409);
    assert.deepEqual(body, {
      error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
    });
  });

  it('maps invalid login credentials to 401', async () => {
    const req = createJsonRequest({ email: 'nobody@test.com', password: 'password123' });
    const res = createResponse();

    await controller.login(req, res);

    const body = readResponseJson(res);
    assert.equal(res.writtenStatus, 401);
    assert.deepEqual(body, {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
  });
});
