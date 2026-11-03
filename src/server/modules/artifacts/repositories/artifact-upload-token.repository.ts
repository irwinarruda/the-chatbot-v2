import { createHash, randomBytes } from "node:crypto";
import type {
  ArtifactUploadTokenStatusDTO,
  CreatedArtifactUploadTokenDTO,
} from "~/domain/artifacts/artifact-commands";
import type { DatabaseGateway } from "~/server/shared/database/database";

export class ArtifactUploadTokenRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async rotate(idUser: string): Promise<CreatedArtifactUploadTokenDTO> {
    const token = `tca_${randomBytes(32).toString("base64url")}`;
    const createdAt = new Date();
    await this.database.sql`
      INSERT INTO artifact_upload_tokens (
        id_user,
        token_hash,
        created_at,
        last_used_at
      )
      VALUES (
        ${idUser},
        ${hashToken(token)},
        ${createdAt},
        ${null}
      )
      ON CONFLICT (id_user) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        created_at = EXCLUDED.created_at,
        last_used_at = NULL
    `;
    return { configured: true, token, createdAt };
  }

  async status(idUser: string): Promise<ArtifactUploadTokenStatusDTO> {
    const rows = await this.database.sql<DbArtifactUploadToken[]>`
      SELECT created_at, last_used_at
      FROM artifact_upload_tokens
      WHERE id_user = ${idUser}
    `;
    const row = rows[0];
    if (!row) return { configured: false };
    return {
      configured: true,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at ?? undefined,
    };
  }

  async revoke(idUser: string): Promise<void> {
    await this.database.sql`
      DELETE FROM artifact_upload_tokens WHERE id_user = ${idUser}
    `;
  }

  async use(token: string): Promise<string | undefined> {
    const rows = await this.database.sql<Array<{ id_user: string }>>`
      UPDATE artifact_upload_tokens
      SET last_used_at = ${new Date()}
      WHERE token_hash = ${hashToken(token)}
      RETURNING id_user
    `;
    return rows[0]?.id_user;
  }
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

interface DbArtifactUploadToken {
  created_at: Date;
  last_used_at: Date | null;
}
