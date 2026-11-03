import type { ArtifactRepository } from "~/client/modules/artifacts/app/repositories/ArtifactRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import {
  type ArtifactDTO,
  ArtifactSummaryResponseDTO,
  ArtifactsResponseDTO,
  ArtifactUploadTokenResponseDTO,
  ArtifactUploadTokenStatusResponseDTO as ArtifactUploadTokenStatusContract,
  type ArtifactUploadTokenStatusResponseDTO,
  type ArtifactViewerDTO,
  ArtifactViewerResponseDTO,
} from "~/contracts/http/artifacts/artifact";
import type { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

export const apiArtifactRepository: ArtifactRepository = {
  async listArtifacts(): Promise<ArtifactDTO[]> {
    const response = await apiClient.request("/api/v1/web/artifacts");
    return ArtifactsResponseDTO.parse(await response.json()).artifacts;
  },

  async getArtifact(id: string): Promise<ArtifactViewerDTO> {
    const response = await apiClient.request(`/api/v1/artifacts/${id}`);
    return ArtifactViewerResponseDTO.parse(await response.json()).artifact;
  },

  async changeVisibility(
    id: string,
    visibility: ArtifactVisibility,
  ): Promise<ArtifactDTO> {
    const response = await apiClient.request(`/api/v1/web/artifacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    return ArtifactSummaryResponseDTO.parse(await response.json());
  },

  async deleteArtifact(id: string): Promise<void> {
    await apiClient.request(`/api/v1/web/artifacts/${id}`, {
      method: "DELETE",
    });
  },

  async getUploadTokenStatus(): Promise<ArtifactUploadTokenStatusResponseDTO> {
    const response = await apiClient.request("/api/v1/web/artifacts/token");
    return ArtifactUploadTokenStatusContract.parse(await response.json());
  },

  async rotateUploadToken() {
    const response = await apiClient.request("/api/v1/web/artifacts/token", {
      method: "POST",
    });
    return ArtifactUploadTokenResponseDTO.parse(await response.json());
  },

  async revokeUploadToken(): Promise<void> {
    await apiClient.request("/api/v1/web/artifacts/token", {
      method: "DELETE",
    });
  },
};
