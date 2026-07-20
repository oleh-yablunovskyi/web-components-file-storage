import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contentDisposition } from '../src/utils.js';

describe('contentDisposition', () => {
  it('passes a plain ASCII name through unchanged', () => {
    assert.equal(
      contentDisposition('report.txt'),
      `attachment; filename="report.txt"; filename*=UTF-8''report.txt`,
    );
  });

  it('strips unsafe chars from the fallback, keeps the exact name in filename*', () => {
    assert.equal(
      contentDisposition(`таска"(v1)'*.txt`),
      `attachment; filename="(v1)'*.txt"; filename*=UTF-8''%D1%82%D0%B0%D1%81%D0%BA%D0%B0%22%28v1%29%27%2A.txt`,
    );
  });
});
