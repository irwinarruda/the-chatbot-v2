import type { Artifact } from "~/domain/artifacts/artifact";
import type { ArtifactUploadTokenStatusDTO } from "~/domain/artifacts/artifact-commands";
import {
  ArtifactSummaryResponseDTO,
  ArtifactUploadTokenStatusResponseDTO,
  ArtifactViewerResponseDTO,
} from "./artifact";

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
