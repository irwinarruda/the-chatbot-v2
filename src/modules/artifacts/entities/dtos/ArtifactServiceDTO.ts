import type { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";

export interface SaveArtifactDTO {
  title: string;
  html: string;
  visibility: ArtifactVisibility;
}

export interface ArtifactUploadTokenStatusDTO {
  configured: boolean;
  createdAt?: Date;
  lastUsedAt?: Date;
}

export interface CreatedArtifactUploadTokenDTO
  extends ArtifactUploadTokenStatusDTO {
  token: string;
}
