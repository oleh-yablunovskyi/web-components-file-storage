import http from 'node:http';
import { config } from './config.js';

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
});
