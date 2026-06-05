import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { Router } from '../src/router.js';

type TestResponse = http.ServerResponse & {
  ended?: boolean;
  writtenStatus?: number;
};

function createRequest(method: string, url: string): http.IncomingMessage {
  return { method, url } as unknown as http.IncomingMessage;
}

function createResponse(): TestResponse {
  const response = {
    writeHead(statusCode: number) {
      response.writtenStatus = statusCode;
      return response;
    },
    end() {
      response.ended = true;
      return response;
    },
  } as unknown as TestResponse;

  return response;
}

describe('Router', () => {
  it('calls the handler for a registered method and path', async () => {
    const router = new Router();
    const req = createRequest('GET', '/api/health?verbose=true');
    const res = createResponse();
    let called = false;

    router.get('/api/health', () => {
      called = true;
    });

    await router.handle(req, res);

    assert.equal(called, true);
  });

  it('returns 404 for an unknown route', async () => {
    const router = new Router();
    const req = createRequest('POST', '/api/health');
    const res = createResponse();

    router.get('/api/health', () => {});

    await router.handle(req, res);

    assert.equal(res.writtenStatus, 404);
    assert.equal(res.ended, true);
  });

  it('throws when the same method and path are registered twice', () => {
    const router = new Router();

    router.get('/api/health', () => {});

    assert.throws(
      () => router.get('/api/health', () => {}),
      /Route already registered: GET \/api\/health/,
    );
  });
});
