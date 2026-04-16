import http from 'node:http';
import { config } from './config.js';
import { pool } from './db.js';

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  res.writeHead(404);
  res.end();
});

try {
  await pool.query('SELECT 1');
  console.log('[api] db connected');
} catch (err) {
  console.error('[api] db connection failed:', (err as Error).message);
  process.exit(1);
}

server.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
});
