import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../errors.js';
import type { AuthRepository } from './auth.repository.js';
import type { User } from './auth.repository.js';

const BCRYPT_SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 100;

export class AuthService {
  constructor(private repo: AuthRepository) {}

  private signToken(user: User): string {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name }, config.jwtSecret);
  }

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      throw new ApiError(400, 'INVALID_PASSWORD', 'Password must be 8\u2013100 characters');
    }

    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }

    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await this.repo.insert(name, email, hash);
    return { user, token: this.signToken(user) };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const row = await this.repo.findByEmail(email);
    if (!row) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    };
    return { user, token: this.signToken(user) };
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
