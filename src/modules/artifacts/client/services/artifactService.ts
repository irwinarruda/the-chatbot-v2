import {
  type ArtifactDTO,
  ArtifactSummaryResponseDTO,
  ArtifactsResponseDTO,
  ArtifactUploadTokenResponseDTO,
  ArtifactUploadTokenStatusResponseDTO as ArtifactUploadTokenStatusContract,
  type ArtifactUploadTokenStatusResponseDTO,
  type ArtifactViewerDTO,
  ArtifactViewerResponseDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import type { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

async function parseError(response: Response): Promise<Error> {
  const body = ApiErrorResponseDTO.safeParse(
    normalizeApiResponse(await response.json()),
  );
  if (body.success) return new Error(body.data.message);
  return new Error(`Request failed with ${response.status}`);
}

export const artifactService = {
  async listArtifacts(): Promise<ArtifactDTO[]> {
    const response = await fetch("/api/v1/web/artifacts");
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(ArtifactsResponseDTO, await response.json())
      .artifacts;
  },

  async getArtifact(id: string): Promise<ArtifactViewerDTO> {
    const response = await fetch(`/api/v1/artifacts/${id}`);
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(ArtifactViewerResponseDTO, await response.json())
      .artifact;
  },

  async changeVisibility(
    id: string,
    visibility: ArtifactVisibility,
  ): Promise<ArtifactDTO> {
    const response = await fetch(`/api/v1/web/artifacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(ArtifactSummaryResponseDTO, await response.json());
  },

  async deleteArtifact(id: string): Promise<void> {
    const response = await fetch(`/api/v1/web/artifacts/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },

  async getUploadTokenStatus(): Promise<ArtifactUploadTokenStatusResponseDTO> {
    const response = await fetch("/api/v1/web/artifacts/token");
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(
      ArtifactUploadTokenStatusContract,
      await response.json(),
    );
  },

  async rotateUploadToken() {
    const response = await fetch("/api/v1/web/artifacts/token", {
      method: "POST",
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(
      ArtifactUploadTokenResponseDTO,
      await response.json(),
    );
  },

  async revokeUploadToken(): Promise<void> {
    const response = await fetch("/api/v1/web/artifacts/token", {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },
};
