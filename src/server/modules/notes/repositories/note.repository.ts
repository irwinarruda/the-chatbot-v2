import { Note } from "~/domain/notes/note";
import type { DatabaseGateway } from "~/server/shared/database/database";

export class NoteRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async list(idUser: string, search?: string): Promise<Note[]> {
    const rows = await this.database.sql<DbNote[]>`
      SELECT *
      FROM notes
      WHERE id_user = ${idUser}
      AND (${search ?? null}::text IS NULL OR (
        name ILIKE ${search ? `%${search}%` : null}
        OR markdown ILIKE ${search ? `%${search}%` : null}
      ))
      ORDER BY updated_at DESC
    `;
    return rows.map(restoreNote);
  }

  async get(idUser: string, id: string): Promise<Note | undefined> {
    const rows = await this.database.sql<DbNote[]>`
      SELECT * FROM notes
      WHERE id_user = ${idUser}
      AND id = ${id}
    `;
    return rows.map(restoreNote)[0];
  }

  async hasName(
    idUser: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const rows = await this.database.sql<Array<{ id: string }>>`
      SELECT id FROM notes
      WHERE id_user = ${idUser}
      AND LOWER(name) = LOWER(${name.trim()})
      AND (${exceptId ?? null}::uuid IS NULL OR id != ${exceptId ?? null})
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async create(note: Note): Promise<void> {
    await this.database.sql`
      INSERT INTO notes (
        id,
        id_user,
        id_source_message,
        name,
        markdown,
        created_at,
        updated_at
      )
      VALUES (
        ${note.id},
        ${note.idUser},
        ${note.idSourceMessage ?? null},
        ${note.name},
        ${note.markdown},
        ${note.createdAt},
        ${note.updatedAt}
      )
    `;
  }

  async save(note: Note): Promise<void> {
    await this.database.sql`
      UPDATE notes SET
        name = ${note.name},
        markdown = ${note.markdown},
        updated_at = ${note.updatedAt}
      WHERE id_user = ${note.idUser}
      AND id = ${note.id}
    `;
  }

  async delete(idUser: string, id: string): Promise<boolean> {
    const result = await this.database.sql`
      DELETE FROM notes
      WHERE id_user = ${idUser}
      AND id = ${id}
    `;
    return result.count > 0;
  }
}

function restoreNote(row: DbNote): Note {
  return Note.restore({
    id: row.id,
    idUser: row.id_user,
    idSourceMessage: row.id_source_message ?? undefined,
    name: row.name,
    markdown: row.markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

interface DbNote {
  id: string;
  id_user: string;
  id_source_message: string | null;
  name: string;
  markdown: string;
  created_at: Date;
  updated_at: Date;
}
