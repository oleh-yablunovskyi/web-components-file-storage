import http from 'node:http';
import { config } from './config.js';
import { pool } from './db.js';
import { s3Client, bucket, waitForObjectStore, S3ObjectStore } from './s3.js';
import { sendError } from './utils.js';
import { AuthRepository } from './auth/auth.repository.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { requireAuth } from './auth/auth.guard.js';
import { FilesRepository } from './files/files.repository.js';
import { FilesStore } from './files/files.store.js';
import { FilesController } from './files/files.controller.js';
import { HealthController } from './health/health.controller.js';
import { Router } from './router.js';

// health
const healthController = new HealthController();

// auth
const authRepo = new AuthRepository(pool);
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);

// files
const filesRepo = new FilesRepository(pool);
const filesStore = new FilesStore(filesRepo, new S3ObjectStore(s3Client, bucket));
const filesController = new FilesController(filesStore);

const router = new Router();

router.get('/api/health', (req, res) => healthController.health(req, res));

router.post('/api/register', (req, res) => authController.register(req, res));
router.post('/api/login', (req, res) => authController.login(req, res));

router.post('/api/files', requireAuth(authService, (req, res, user) => filesController.upload(req, res, user)));
router.get('/api/files', requireAuth(authService, (req, res, user) => filesController.list(req, res, user)));

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  try {
    await router.handle(req, res);
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

await waitForObjectStore();

server.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
});
