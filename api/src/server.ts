import http from 'node:http';
import { config } from './config.js';
import { pool } from './db.js';
import { sendError } from './utils.js';
import { AuthRepository } from './auth/auth.repository.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './health/health.controller.js';

const authRepo = new AuthRepository(pool);
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);
const healthController = new HealthController();

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      healthController.health(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/register') {
      await authController.register(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/login') {
      await authController.login(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  } catch (err: unknown) {
    sendError(res, err);
  } finally {
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
  }
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
