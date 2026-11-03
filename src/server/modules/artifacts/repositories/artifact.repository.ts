import { Artifact } from "~/domain/artifacts/artifact";
import type { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import type { DatabaseGateway } from "~/server/shared/database/database";

export interface ArtifactSnapshot {
  artifact: Artifact;
  concurrencyToken: string;
}

export class ArtifactRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async list(idUser: string): Promise<Artifact[]> {
    const rows = await this.database.sql<DbArtifact[]>`
      SELECT *
      FROM artifacts
      WHERE id_user = ${idUser}
      ORDER BY updated_at DESC
    `;
    return rows.map(restoreArtifact);
  }

  async get(artifactId: string): Promise<Artifact | undefined> {
    const rows = await this.database.sql<DbArtifact[]>`
      SELECT * FROM artifacts WHERE id = ${artifactId}
    `;
    return rows.map(restoreArtifact)[0];
  }

  async getOwnedSnapshot(
    idUser: string,
    artifactId: string,
  ): Promise<ArtifactSnapshot | undefined> {
    const rows = await this.database.sql<DbArtifactSnapshot[]>`
      SELECT *, xmin::text AS concurrency_token
      FROM artifacts
      WHERE id_user = ${idUser}
      AND id = ${artifactId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      artifact: restoreArtifact(row),
      concurrencyToken: row.concurrency_token,
    };
  }

  async create(artifact: Artifact): Promise<void> {
    await this.database.sql`
      INSERT INTO artifacts (
        id,
        id_user,
        title,
        visibility,
        source_html,
        rendered_html,
        renderer_version,
        version,
        created_at,
        updated_at
      )
      VALUES (
        ${artifact.id},
        ${artifact.idUser},
        ${artifact.title},
        ${artifact.visibility},
        ${artifact.sourceHtml},
        ${artifact.renderedHtml},
        ${artifact.rendererVersion},
        ${artifact.version},
        ${artifact.createdAt},
        ${artifact.updatedAt}
      )
    `;
  }

  async replace(
    artifact: Artifact,
    concurrencyToken: string,
  ): Promise<Artifact | undefined> {
    const rows = await this.database.sql<DbArtifact[]>`
      UPDATE artifacts SET
        title = ${artifact.title},
        visibility = ${artifact.visibility},
        source_html = ${artifact.sourceHtml},
        rendered_html = ${artifact.renderedHtml},
        renderer_version = ${artifact.rendererVersion},
        version = ${artifact.version},
        updated_at = ${artifact.updatedAt}
      WHERE id_user = ${artifact.idUser}
      AND id = ${artifact.id}
      AND xmin::text = ${concurrencyToken}
      RETURNING *
    `;
    return rows.map(restoreArtifact)[0];
  }

  async saveVisibility(artifact: Artifact): Promise<Artifact | undefined> {
    const rows = await this.database.sql<DbArtifact[]>`
      UPDATE artifacts SET
        visibility = ${artifact.visibility},
        updated_at = ${artifact.updatedAt}
      WHERE id_user = ${artifact.idUser}
      AND id = ${artifact.id}
      RETURNING *
    `;
    return rows.map(restoreArtifact)[0];
  }

  async delete(idUser: string, artifactId: string): Promise<boolean> {
    const result = await this.database.sql`
      DELETE FROM artifacts
      WHERE id_user = ${idUser}
      AND id = ${artifactId}
    `;
    return result.count > 0;
  }
}

function restoreArtifact(row: DbArtifact): Artifact {
  return Artifact.restore({
    id: row.id,
    idUser: row.id_user,
    title: row.title,
    visibility: row.visibility,
    sourceHtml: row.source_html,
    renderedHtml: row.rendered_html,
    rendererVersion: row.renderer_version,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

interface DbArtifact {
  id: string;
  id_user: string;
  title: string;
  visibility: ArtifactVisibility;
  source_html: string;
  rendered_html: string;
  renderer_version: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface DbArtifactSnapshot extends DbArtifact {
  concurrency_token: string;
}
