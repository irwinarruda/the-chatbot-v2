import type { Artifact } from "~/modules/artifacts/entities/Artifact";
import {
  ArtifactSummaryResponseDTO,
  ArtifactUploadTokenStatusResponseDTO,
  ArtifactViewerResponseDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import type { ArtifactUploadTokenStatusDTO } from "~/modules/artifacts/entities/dtos/ArtifactServiceDTO";

export function toArtifactSummaryResponse(
  artifact: Artifact,
): ArtifactSummaryResponseDTO {
  return ArtifactSummaryResponseDTO.parse({
    id: artifact.id,
    title: artifact.title,
    visibility: artifact.visibility,
    version: artifact.version,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
  });
}

export function toArtifactViewerResponse(
  artifact: Artifact,
): ArtifactViewerResponseDTO {
  return ArtifactViewerResponseDTO.parse({
    artifact: {
      ...toArtifactSummaryResponse(artifact),
      renderedHtml: artifact.renderedHtml,
    },
  });
}

export function toArtifactUploadTokenStatusResponse(
  status: ArtifactUploadTokenStatusDTO,
): ArtifactUploadTokenStatusResponseDTO {
  return ArtifactUploadTokenStatusResponseDTO.parse({
    configured: status.configured,
    createdAt: status.createdAt?.toISOString(),
    lastUsedAt: status.lastUsedAt?.toISOString(),
  });
}
