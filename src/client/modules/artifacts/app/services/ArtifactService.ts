import type { StateCreator } from "zustand";
import type { ArtifactRepository } from "~/client/modules/artifacts/app/repositories/ArtifactRepository";
import { type ApiError, clientError } from "~/client/shared/error/ApiError";
import type {
  ArtifactDTO,
  ArtifactUploadTokenStatusResponseDTO,
  ArtifactViewerDTO,
} from "~/contracts/http/artifacts/artifact";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

export type ArtifactErrorCode = "loading" | "saving" | "deleting";
export type UploadTokenErrorCode = "loading" | "mutation";

export interface ArtifactService {
  artifacts: ArtifactDTO[];
  isArtifactsLoading: boolean;
  isArtifactSubmitting: boolean;
  artifactError?: ArtifactErrorCode | ApiError;
  uploadTokenStatus?: ArtifactUploadTokenStatusResponseDTO;
  revealedUploadToken?: string;
  isUploadTokenSubmitting: boolean;
  uploadTokenError?: UploadTokenErrorCode | ApiError;
  viewedArtifact?: ArtifactViewerDTO;
  hasViewedArtifactError: boolean;
  loadArtifacts: () => Promise<void>;
  toggleArtifactVisibility: (artifact: ArtifactDTO) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
  loadUploadTokenStatus: () => Promise<void>;
  hideUploadToken: () => void;
  rotateUploadToken: () => Promise<void>;
  revokeUploadToken: () => Promise<void>;
  viewArtifact: (artifactId: string) => Promise<void>;
  closeArtifact: () => void;
  resetArtifacts: () => void;
}

export function createArtifactService(
  repository: ArtifactRepository,
): StateCreator<ArtifactService> {
  return (set, get) => {
    let listRequest = 0;
    let tokenRequest = 0;
    let viewRequest = 0;
    return {
      artifacts: [],
      isArtifactsLoading: true,
      isArtifactSubmitting: false,
      artifactError: undefined,
      uploadTokenStatus: undefined,
      revealedUploadToken: undefined,
      isUploadTokenSubmitting: false,
      uploadTokenError: undefined,
      viewedArtifact: undefined,
      hasViewedArtifactError: false,
      async loadArtifacts() {
        const request = ++listRequest;
        set({ isArtifactsLoading: true, artifactError: undefined });
        try {
          const artifacts = await repository.listArtifacts();
          if (request === listRequest) set({ artifacts });
        } catch (error) {
          if (request === listRequest) {
            set({ artifactError: clientError(error, "loading") });
          }
        } finally {
          if (request === listRequest) set({ isArtifactsLoading: false });
        }
      },
      async toggleArtifactVisibility(artifact) {
        const { isArtifactSubmitting } = get();
        if (isArtifactSubmitting) return;
        set({ isArtifactSubmitting: true, artifactError: undefined });
        let visibility: ArtifactVisibility = ArtifactVisibility.Public;
        if (artifact.visibility === ArtifactVisibility.Public) {
          visibility = ArtifactVisibility.Private;
        }
        try {
          const updated = await repository.changeVisibility(
            artifact.id,
            visibility,
          );
          const { artifacts } = get();
          set({
            artifacts: artifacts.map((item) => {
              if (item.id === updated.id) return updated;
              return item;
            }),
          });
        } catch (error) {
          set({ artifactError: clientError(error, "saving") });
        } finally {
          set({ isArtifactSubmitting: false });
        }
      },
      async deleteArtifact(artifactId) {
        const { isArtifactSubmitting } = get();
        if (isArtifactSubmitting) return;
        set({ isArtifactSubmitting: true, artifactError: undefined });
        try {
          await repository.deleteArtifact(artifactId);
          const { artifacts } = get();
          set({
            artifacts: artifacts.filter((item) => item.id !== artifactId),
          });
        } catch (error) {
          set({ artifactError: clientError(error, "deleting") });
        } finally {
          set({ isArtifactSubmitting: false });
        }
      },
      async loadUploadTokenStatus() {
        const request = ++tokenRequest;
        set({
          uploadTokenStatus: undefined,
          revealedUploadToken: undefined,
          uploadTokenError: undefined,
        });
        try {
          const uploadTokenStatus = await repository.getUploadTokenStatus();
          if (request === tokenRequest) set({ uploadTokenStatus });
        } catch (error) {
          if (request === tokenRequest) {
            set({ uploadTokenError: clientError(error, "loading") });
          }
        }
      },
      async rotateUploadToken() {
        const { uploadTokenStatus, isUploadTokenSubmitting } = get();
        if (!uploadTokenStatus || isUploadTokenSubmitting) return;
        tokenRequest += 1;
        set({ isUploadTokenSubmitting: true, uploadTokenError: undefined });
        try {
          const created = await repository.rotateUploadToken();
          set({
            uploadTokenStatus: created,
            revealedUploadToken: created.token,
          });
        } catch (error) {
          set({ uploadTokenError: clientError(error, "mutation") });
        } finally {
          set({ isUploadTokenSubmitting: false });
        }
      },
      async revokeUploadToken() {
        const { uploadTokenStatus, isUploadTokenSubmitting } = get();
        if (!uploadTokenStatus?.configured || isUploadTokenSubmitting) return;
        tokenRequest += 1;
        set({ isUploadTokenSubmitting: true, uploadTokenError: undefined });
        try {
          await repository.revokeUploadToken();
          set({
            uploadTokenStatus: { configured: false },
            revealedUploadToken: undefined,
          });
        } catch (error) {
          set({ uploadTokenError: clientError(error, "mutation") });
        } finally {
          set({ isUploadTokenSubmitting: false });
        }
      },
      hideUploadToken() {
        tokenRequest += 1;
        set({ revealedUploadToken: undefined });
      },
      async viewArtifact(artifactId) {
        const request = ++viewRequest;
        set({ viewedArtifact: undefined, hasViewedArtifactError: false });
        try {
          const viewedArtifact = await repository.getArtifact(artifactId);
          if (request === viewRequest) set({ viewedArtifact });
        } catch {
          if (request === viewRequest) set({ hasViewedArtifactError: true });
        }
      },
      closeArtifact() {
        viewRequest += 1;
        set({ viewedArtifact: undefined, hasViewedArtifactError: false });
      },
      resetArtifacts() {
        listRequest += 1;
        tokenRequest += 1;
        viewRequest += 1;
        set({
          artifacts: [],
          isArtifactsLoading: true,
          isArtifactSubmitting: false,
          artifactError: undefined,
          uploadTokenStatus: undefined,
          revealedUploadToken: undefined,
          isUploadTokenSubmitting: false,
          uploadTokenError: undefined,
          viewedArtifact: undefined,
          hasViewedArtifactError: false,
        });
      },
    };
  };
}
