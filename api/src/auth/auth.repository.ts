import type pg from 'pg';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export type User = Omit<UserRow, 'password_hash'>;

export class AuthRepository {
  constructor(private pool: pg.Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    return rows[0] ?? null;
  }

  async insert(name: string, email: string, passwordHash: string): Promise<User> {
    const { rows } = await this.pool.query<User>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash],
    );
    return rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<User>(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }
}
