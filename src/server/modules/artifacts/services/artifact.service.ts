import { Artifact } from "~/domain/artifacts/artifact";
import type {
  ArtifactUploadTokenStatusDTO,
  CreatedArtifactUploadTokenDTO,
  SaveArtifactDTO,
} from "~/domain/artifacts/artifact-commands";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import type {
  ArtifactRepository,
  ArtifactSnapshot,
} from "~/server/modules/artifacts/repositories/artifact.repository";
import type { ArtifactUploadTokenRepository } from "~/server/modules/artifacts/repositories/artifact-upload-token.repository";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "~/server/shared/errors/application-errors";

const UPLOAD_TOKEN_PATTERN = /^tca_[A-Za-z0-9_-]{43}$/;

type CompileArtifact = (
  sourceHtml: string,
  title: string,
) => Promise<{ html: string; rendererVersion: string }>;

export class ArtifactService {
  constructor(
    private artifacts: ArtifactRepository,
    private uploadTokens: ArtifactUploadTokenRepository,
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
    await this.artifacts.create(artifact);
    return this.getOwnedArtifact(artifact.idUser, artifact.id);
  }

  async replaceArtifact(
    idUser: string,
    artifactId: string,
    dto: SaveArtifactDTO,
  ): Promise<Artifact> {
    const { artifact, concurrencyToken } = await this.getOwnedSnapshot(
      idUser,
      artifactId,
    );
    const compiled = await this.compileArtifact(dto.html, dto.title);
    artifact.replace({
      title: dto.title,
      visibility: dto.visibility,
      sourceHtml: dto.html,
      renderedHtml: compiled.html,
      rendererVersion: compiled.rendererVersion,
    });
    const replaced = await this.artifacts.replace(artifact, concurrencyToken);
    if (!replaced) {
      throw new ConflictException(
        "The artifact changed while this replacement was being prepared.",
        "Load the current artifact and publish the replacement again.",
      );
    }
    return replaced;
  }

  async listArtifacts(idUser: string): Promise<Artifact[]> {
    return this.artifacts.list(idUser);
  }

  async getArtifactForViewer(
    artifactId: string,
    viewerUserId?: string,
  ): Promise<Artifact> {
    const artifact = await this.artifacts.get(artifactId);
    if (!artifact) throw new NotFoundException("Artifact not found");
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
    const updated = await this.artifacts.saveVisibility(artifact);
    if (!updated) throw new NotFoundException("Artifact not found");
    return updated;
  }

  async deleteArtifact(idUser: string, artifactId: string): Promise<void> {
    const isDeleted = await this.artifacts.delete(idUser, artifactId);
    if (!isDeleted) throw new NotFoundException("Artifact not found");
  }

  async rotateUploadToken(
    idUser: string,
  ): Promise<CreatedArtifactUploadTokenDTO> {
    return this.uploadTokens.rotate(idUser);
  }

  async getUploadTokenStatus(
    idUser: string,
  ): Promise<ArtifactUploadTokenStatusDTO> {
    return this.uploadTokens.status(idUser);
  }

  async revokeUploadToken(idUser: string): Promise<void> {
    await this.uploadTokens.revoke(idUser);
  }

  async authenticateUploadToken(token: string): Promise<string> {
    const normalizedToken = token.trim();
    if (!UPLOAD_TOKEN_PATTERN.test(normalizedToken)) {
      throw createUploadTokenError();
    }
    const idUser = await this.uploadTokens.use(normalizedToken);
    if (!idUser) throw createUploadTokenError();
    return idUser;
  }

  private async getOwnedArtifact(
    idUser: string,
    artifactId: string,
  ): Promise<Artifact> {
    const { artifact } = await this.getOwnedSnapshot(idUser, artifactId);
    return artifact;
  }

  private async getOwnedSnapshot(
    idUser: string,
    artifactId: string,
  ): Promise<ArtifactSnapshot> {
    const snapshot = await this.artifacts.getOwnedSnapshot(idUser, artifactId);
    if (!snapshot) throw new NotFoundException("Artifact not found");
    return snapshot;
  }
}

function createUploadTokenError(): UnauthorizedException {
  return new UnauthorizedException(
    "The artifact upload token is invalid.",
    "Rotate the token from the artifacts page and try again.",
  );
}

async function compileArtifactLazily(sourceHtml: string, title: string) {
  const { compileArtifactHtml } = await import(
    "~/server/modules/artifacts/utils/artifact-html-compiler"
  );
  return compileArtifactHtml(sourceHtml, title);
}
