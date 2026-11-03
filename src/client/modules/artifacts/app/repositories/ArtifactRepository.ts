import type {
  ArtifactDTO,
  ArtifactUploadTokenResponseDTO,
  ArtifactUploadTokenStatusResponseDTO,
  ArtifactViewerDTO,
} from "~/contracts/http/artifacts/artifact";
import type { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

export interface ArtifactRepository {
  listArtifacts(): Promise<ArtifactDTO[]>;
  getArtifact(id: string): Promise<ArtifactViewerDTO>;
  changeVisibility(
    id: string,
    visibility: ArtifactVisibility,
  ): Promise<ArtifactDTO>;
  deleteArtifact(id: string): Promise<void>;
  getUploadTokenStatus(): Promise<ArtifactUploadTokenStatusResponseDTO>;
  rotateUploadToken(): Promise<ArtifactUploadTokenResponseDTO>;
  revokeUploadToken(): Promise<void>;
}
