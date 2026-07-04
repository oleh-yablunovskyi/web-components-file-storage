import type pg from 'pg';
import type { FileMeta } from './file-meta.interface.js';

interface FileRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string; // pg returns bigint as a string
  uploaded_at: Date; // pg parses timestamptz into a Date
}

export interface FileInsert {
  id: string;
  userId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
}

function toMeta(row: FileRow): FileMeta {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedAt: row.uploaded_at.toISOString(),
  };
}

export interface FilesRepo {
  insert(file: FileInsert): Promise<FileMeta>;
  list(userId: string): Promise<FileMeta[]>;
}

export class FilesRepository implements FilesRepo {
  constructor(private pool: pg.Pool) {}

  async insert(file: FileInsert): Promise<FileMeta> {
    const { rows } = await this.pool.query<FileRow>(
      `INSERT INTO files (id, user_id, name, mime_type, size_bytes, s3_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, mime_type, size_bytes, uploaded_at`,
      [file.id, file.userId, file.name, file.mimeType, file.sizeBytes, file.s3Key],
    );
    return toMeta(rows[0]);
  }

  async list(userId: string): Promise<FileMeta[]> {
    const { rows } = await this.pool.query<FileRow>(
      `SELECT id, name, mime_type, size_bytes, uploaded_at
       FROM files WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [userId],
    );
    return rows.map(toMeta);
  }
}
