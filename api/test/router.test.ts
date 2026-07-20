import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { Router } from '../src/router.js';

type TestResponse = http.ServerResponse & {
  ended?: boolean;
  writtenStatus?: number;
  body?: string;
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
    end(body?: string) {
      response.body = body;
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

  it('responds to an unknown route with the standard NOT_FOUND error shape', async () => {
    const router = new Router();
    const res = createResponse();

    await router.handle(createRequest('GET', '/api/nope'), res);

    assert.equal(res.writtenStatus, 404);
    assert.deepEqual(JSON.parse(res.body!), { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('matches a :param route and passes the captured id to the handler', async () => {
    const router = new Router();
    const res = createResponse();
    let capturedId: string | undefined;

    router.get('/api/files/:id', (_req, _res, params) => {
      capturedId = params.id;
    });

    await router.handle(createRequest('GET', '/api/files/abc-123'), res);

    assert.equal(capturedId, 'abc-123');
  });

  it('keeps static routes matching alongside a :param route on the same prefix', async () => {
    const router = new Router();
    let listed = false;
    let downloadedId: string | undefined;

    router.get('/api/files', () => {
      listed = true;
    });
    router.get('/api/files/:id', (_req, _res, params) => {
      downloadedId = params.id;
    });

    await router.handle(createRequest('GET', '/api/files'), createResponse());
    await router.handle(createRequest('GET', '/api/files/xyz'), createResponse());

    assert.equal(listed, true);
    assert.equal(downloadedId, 'xyz');
  });

  it('returns 404 when a :param route exists but the method differs', async () => {
    const router = new Router();
    const res = createResponse();

    router.get('/api/files/:id', () => {});

    await router.handle(createRequest('DELETE', '/api/files/abc-123'), res);

    assert.equal(res.writtenStatus, 404);
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
