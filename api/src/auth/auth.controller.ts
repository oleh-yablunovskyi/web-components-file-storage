import type http from 'node:http';
import type { AuthService, AuthServiceError } from './auth.service.js';
import { ApiError } from '../errors.js';
import { readJson, sendJson } from '../utils.js';

const AUTH_ERROR_STATUS: Record<AuthServiceError['code'], number> = {
  INVALID_PASSWORD: 400,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
};

export class AuthController {
  constructor(private service: AuthService) {}

  async register(req: http.IncomingMessage, res: http.ServerResponse) {
    const { name, email, password } = await readJson(req);
    if (!name || !email || !password) {
      throw new ApiError(400, 'MISSING_FIELDS', 'name, email, and password are required');
    }
    const result = await this.service.register(name, email, password);
    if (!result.ok) {
      sendJson(res, AUTH_ERROR_STATUS[result.error.code], { error: result.error });
      return;
    }

    sendJson(res, 201, result.value);
  }

  async login(req: http.IncomingMessage, res: http.ServerResponse) {
    const { email, password } = await readJson(req);
    if (!email || !password) {
      throw new ApiError(400, 'MISSING_FIELDS', 'email and password are required');
    }
    const result = await this.service.login(email, password);
    if (!result.ok) {
      sendJson(res, AUTH_ERROR_STATUS[result.error.code], { error: result.error });
      return;
    }

    sendJson(res, 200, result.value);
  }
}
