import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Result } from '../types/result.js';
import type { AuthRepository } from './auth.repository.js';
import type { User } from './user.interface.js';

const BCRYPT_SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 100;

export type AuthSession = { user: User; token: string };

export type AuthServiceError = {
  code: 'INVALID_PASSWORD' | 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS';
  message: string;
};

export class AuthService {
  constructor(private repo: AuthRepository) {}

  private signToken(user: User): string {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name }, config.jwtSecret);
  }

  async register(name: string, email: string, password: string): Promise<Result<AuthSession, AuthServiceError>> {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return {
        ok: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be 8\u2013100 characters' },
      };
    }

    const existing = await this.repo.findByEmail(email);
    if (existing) {
      return {
        ok: false,
        error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
      };
    }

    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await this.repo.insert(name, email, hash);
    return { ok: true, value: { user, token: this.signToken(user) } };
  }

  async login(email: string, password: string): Promise<Result<AuthSession, AuthServiceError>> {
    const result = await this.repo.findByEmail(email);
    if (!result) {
      return {
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      };
    }

    const match = await bcrypt.compare(password, result.passwordHash);
    if (!match) {
      return {
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      };
    }

    return { ok: true, value: { user: result.user, token: this.signToken(result.user) } };
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { sub: string; email: string };
      return this.repo.findById(payload.sub);
    } catch {
      return null;
    }
  }
}
