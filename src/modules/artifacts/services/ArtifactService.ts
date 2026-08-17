import { createHash, randomBytes } from "node:crypto";
import { Artifact } from "~/modules/artifacts/entities/Artifact";
import type {
  ArtifactUploadTokenStatusDTO,
  CreatedArtifactUploadTokenDTO,
  SaveArtifactDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactServiceDTO";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

const UPLOAD_TOKEN_PATTERN = /^tca_[A-Za-z0-9_-]{43}$/;

type CompileArtifact = (
  sourceHtml: string,
  title: string,
) => Promise<{ html: string; rendererVersion: string }>;

export class ArtifactService {
  constructor(
    private database: DatabaseGateway,
    private compileArtifact: CompileArtifact = compileArtifactLazily,
  ) {}

  async publishArtifact(
    idUser: string,
    dto: SaveArtifactDTO,
  ): Promise<Artifact> {
    const compiled = await this.compileArtifact(dto.html, dto.title);
    const artifact = new Artifact({
      idUser,
      title: dto.title,
      visibility: dto.visibility,
      sourceHtml: dto.html,
      renderedHtml: compiled.html,
      rendererVersion: compiled.rendererVersion,
    });
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
    return this.getOwnedArtifact(artifact.idUser, artifact.id);
  }

  async replaceArtifact(
    idUser: string,
    artifactId: string,
    dto: SaveArtifactDTO,
  ): Promise<Artifact> {
    const snapshot = await this.getOwnedArtifactSnapshot(idUser, artifactId);
    const { artifact } = snapshot;
    const compiled = await this.compileArtifact(dto.html, dto.title);
    artifact.replace({
      title: dto.title,
      visibility: dto.visibility,
      sourceHtml: dto.html,
      renderedHtml: compiled.html,
      rendererVersion: compiled.rendererVersion,
    });
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
      AND xmin::text = ${snapshot.concurrencyToken}
      RETURNING *
    `;
    const replaced = rows[0];
    if (!replaced) {
      throw new ConflictException(
        "The artifact changed while this replacement was being prepared.",
        "Load the current artifact and publish the replacement again.",
      );
    }
    return this.mapArtifact(replaced);
  }

  async listArtifacts(idUser: string): Promise<Artifact[]> {
    const rows = await this.database.sql<DbArtifact[]>`
      SELECT *
      FROM artifacts
      WHERE id_user = ${idUser}
      ORDER BY updated_at DESC
    `;
    return rows.map((row) => this.mapArtifact(row));
  }

  async getArtifactForViewer(
    artifactId: string,
    viewerUserId?: string,
  ): Promise<Artifact> {
    const rows = await this.database.sql<DbArtifact[]>`
      SELECT * FROM artifacts WHERE id = ${artifactId}
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("Artifact not found");
    const artifact = this.mapArtifact(row);
    if (
      artifact.visibility === ArtifactVisibility.Private &&
      artifact.idUser !== viewerUserId
    ) {
      throw new NotFoundException("Artifact not found");
    }
    return artifact;
  }

  async changeVisibility(
    idUser: string,
    artifactId: string,
    visibility: ArtifactVisibility,
  ): Promise<Artifact> {
    const artifact = await this.getOwnedArtifact(idUser, artifactId);
    artifact.changeVisibility(visibility);
    const rows = await this.database.sql<DbArtifact[]>`
      UPDATE artifacts SET
        visibility = ${artifact.visibility},
        updated_at = ${artifact.updatedAt}
      WHERE id_user = ${artifact.idUser}
      AND id = ${artifact.id}
      RETURNING *
    `;
    const updated = rows[0];
    if (!updated) throw new NotFoundException("Artifact not found");
    return this.mapArtifact(updated);
  }

  async deleteArtifact(idUser: string, artifactId: string): Promise<void> {
    const result = await this.database.sql`
      DELETE FROM artifacts
      WHERE id_user = ${idUser}
      AND id = ${artifactId}
    `;
    if (result.count === 0) throw new NotFoundException("Artifact not found");
  }

  async rotateUploadToken(
    idUser: string,
  ): Promise<CreatedArtifactUploadTokenDTO> {
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
        ${this.hashUploadToken(token)},
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

  async getUploadTokenStatus(
    idUser: string,
  ): Promise<ArtifactUploadTokenStatusDTO> {
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

  async revokeUploadToken(idUser: string): Promise<void> {
    await this.database.sql`
      DELETE FROM artifact_upload_tokens WHERE id_user = ${idUser}
    `;
  }

  async authenticateUploadToken(token: string): Promise<string> {
    const normalizedToken = token.trim();
    if (!UPLOAD_TOKEN_PATTERN.test(normalizedToken)) {
      throw this.createUploadTokenError();
    }
    const tokenHash = this.hashUploadToken(normalizedToken);
    const rows = await this.database.sql<Array<{ id_user: string }>>`
      UPDATE artifact_upload_tokens
      SET last_used_at = ${new Date()}
      WHERE token_hash = ${tokenHash}
      RETURNING id_user
    `;
    const row = rows[0];
    if (!row) throw this.createUploadTokenError();
    return row.id_user;
  }

  private async getOwnedArtifact(
    idUser: string,
    artifactId: string,
  ): Promise<Artifact> {
    const snapshot = await this.getOwnedArtifactSnapshot(idUser, artifactId);
    return snapshot.artifact;
  }

  private async getOwnedArtifactSnapshot(
    idUser: string,
    artifactId: string,
  ): Promise<OwnedArtifactSnapshot> {
    const rows = await this.database.sql<DbArtifactSnapshot[]>`
      SELECT *, xmin::text AS concurrency_token
      FROM artifacts
      WHERE id_user = ${idUser}
      AND id = ${artifactId}
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("Artifact not found");
    return {
      artifact: this.mapArtifact(row),
      concurrencyToken: row.concurrency_token,
    };
  }

  private mapArtifact(row: DbArtifact): Artifact {
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

  private hashUploadToken(token: string): Buffer {
    return createHash("sha256").update(token, "utf8").digest();
  }

  private createUploadTokenError(): UnauthorizedException {
    return new UnauthorizedException(
      "The artifact upload token is invalid.",
      "Rotate the token from the artifacts page and try again.",
    );
  }
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

interface DbArtifactUploadToken {
  created_at: Date;
  last_used_at: Date | null;
}

interface DbArtifactSnapshot extends DbArtifact {
  concurrency_token: string;
}

interface OwnedArtifactSnapshot {
  artifact: Artifact;
  concurrencyToken: string;
}

async function compileArtifactLazily(sourceHtml: string, title: string) {
  const { compileArtifactHtml } = await import(
    "~/modules/artifacts/utils/ArtifactHtmlCompiler"
  );
  return compileArtifactHtml(sourceHtml, title);
}
