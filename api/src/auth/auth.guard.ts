import type http from 'node:http';
import type { AuthService } from './auth.service.js';
import type { User } from './user.interface.js';
import { sendJson } from '../utils.js';

type AuthedHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  user: User,
) => void | Promise<void>;

export function requireAuth(authService: AuthService, handler: AuthedHandler) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
      return;
    }

    const user = await authService.verifyToken(token);
    if (!user) {
      sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
      return;
    }

    await handler(req, res, user);
  };
}
