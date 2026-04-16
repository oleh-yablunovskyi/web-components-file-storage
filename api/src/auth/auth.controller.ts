import type http from 'node:http';
import type { AuthService } from './auth.service.js';
import { ApiError } from '../errors.js';
import { readJson, sendJson } from '../utils.js';

export class AuthController {
  constructor(private service: AuthService) {}

  async register(req: http.IncomingMessage, res: http.ServerResponse) {
    const { name, email, password } = await readJson(req);
    if (!name || !email || !password) {
      throw new ApiError(400, 'MISSING_FIELDS', 'name, email, and password are required');
    }
    const result = await this.service.register(name, email, password);
    sendJson(res, 201, result);
  }
}
