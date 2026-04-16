import type http from 'node:http';
import { sendJson } from '../utils.js';

export class HealthController {
  health(_req: http.IncomingMessage, res: http.ServerResponse) {
    sendJson(res, 200, { status: 'ok' });
  }
}
