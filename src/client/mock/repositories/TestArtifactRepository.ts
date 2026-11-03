import { DemoNow, mockDb } from "~/client/mock/db";
import type { ArtifactRepository } from "~/client/modules/artifacts/app/repositories/ArtifactRepository";
import type {
  ArtifactDTO,
  ArtifactViewerDTO,
} from "~/contracts/http/artifacts/artifact";
import type { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import { NotFoundError } from "./NotFoundError";

export class TestArtifactRepository implements ArtifactRepository {
  async listArtifacts() {
    return mockDb.artifacts.map(toSummary);
  }

  async getArtifact(id: string) {
    return findArtifact(id);
  }

  async changeVisibility(id: string, visibility: ArtifactVisibility) {
    const artifact = findArtifact(id);
    artifact.visibility = visibility;
    artifact.updatedAt = DemoNow;
    return toSummary(artifact);
  }

  async deleteArtifact(id: string) {
    mockDb.artifacts = mockDb.artifacts.filter((item) => item.id !== id);
  }

  async getUploadTokenStatus() {
    if (!mockDb.isUploadTokenConfigured) return { configured: false };
    return { configured: true, createdAt: DemoNow, lastUsedAt: DemoNow };
  }

  async rotateUploadToken() {
    mockDb.isUploadTokenConfigured = true;
    return { configured: true, createdAt: DemoNow, token: "tca_demo-token" };
  }

  async revokeUploadToken() {
    mockDb.isUploadTokenConfigured = false;
  }
}

function findArtifact(id: string): ArtifactViewerDTO {
  const artifact = mockDb.artifacts.find((item) => item.id === id);
  if (!artifact) throw new NotFoundError("Artifact not found");
  return artifact;
}

function toSummary({ renderedHtml: _, ...summary }: ArtifactViewerDTO) {
  return summary satisfies ArtifactDTO;
}
