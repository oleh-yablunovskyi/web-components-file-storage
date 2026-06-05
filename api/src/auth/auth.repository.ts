import type pg from 'pg';
import type { User } from './user.interface.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface UserAuthRow extends UserRow {
  password_hash: string;
}

function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

export class AuthRepository {
  constructor(private pool: pg.Pool) {}

  async findByEmail(email: string): Promise<{ user: User; passwordHash: string } | null> {
    const { rows } = await this.pool.query<UserAuthRow>(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    if (!rows[0]) return null;
    return { user: toUser(rows[0]), passwordHash: rows[0].password_hash };
  }

  async insert(name: string, email: string, passwordHash: string): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash],
    );
    return toUser(rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}
