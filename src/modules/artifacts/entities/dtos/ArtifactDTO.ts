import { z } from "zod";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import { ARTIFACT_MAX_SOURCE_BYTES } from "~/modules/artifacts/utils/ArtifactLimits";

export const ArtifactIdDTO = z.string().uuid();
export type ArtifactIdDTO = z.infer<typeof ArtifactIdDTO>;

export const ArtifactVisibilityDTO = z.enum(ArtifactVisibility);
export type ArtifactVisibilityDTO = z.infer<typeof ArtifactVisibilityDTO>;

export const ArtifactSummaryResponseDTO = z.object({
  id: z.string().uuid(),
  title: z.string(),
  visibility: ArtifactVisibilityDTO,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ArtifactSummaryResponseDTO = z.infer<
  typeof ArtifactSummaryResponseDTO
>;
export type ArtifactDTO = ArtifactSummaryResponseDTO;

export const ArtifactsResponseDTO = z.object({
  artifacts: z.array(ArtifactSummaryResponseDTO),
});
export type ArtifactsResponseDTO = z.infer<typeof ArtifactsResponseDTO>;

export const ArtifactViewerResponseDTO = z.object({
  artifact: ArtifactSummaryResponseDTO.extend({ renderedHtml: z.string() }),
});
export type ArtifactViewerResponseDTO = z.infer<
  typeof ArtifactViewerResponseDTO
>;
export type ArtifactViewerDTO = ArtifactViewerResponseDTO["artifact"];

export const PublishArtifactResponseDTO = z.object({
  artifact: ArtifactSummaryResponseDTO,
  url: z.url(),
});
export type PublishArtifactResponseDTO = z.infer<
  typeof PublishArtifactResponseDTO
>;

export const PublishArtifactRequestDTO = z.object({
  title: z.string().trim().min(1).max(160),
  html: z
    .string()
    .min(1)
    .max(ARTIFACT_MAX_SOURCE_BYTES)
    .refine((html) => html.trim().length > 0, "Artifact HTML is required.")
    .refine(
      (html) =>
        new TextEncoder().encode(html).byteLength <= ARTIFACT_MAX_SOURCE_BYTES,
      "Artifact HTML must be at most 1 MiB.",
    ),
  visibility: ArtifactVisibilityDTO.default(ArtifactVisibility.Private),
});
export type PublishArtifactRequestDTO = z.infer<
  typeof PublishArtifactRequestDTO
>;

export const ChangeArtifactVisibilityRequestDTO = z.object({
  visibility: ArtifactVisibilityDTO,
});
export type ChangeArtifactVisibilityRequestDTO = z.infer<
  typeof ChangeArtifactVisibilityRequestDTO
>;

export const ArtifactUploadTokenStatusResponseDTO = z.object({
  configured: z.boolean(),
  createdAt: z.iso.datetime().optional(),
  lastUsedAt: z.iso.datetime().optional(),
});
export type ArtifactUploadTokenStatusResponseDTO = z.infer<
  typeof ArtifactUploadTokenStatusResponseDTO
>;

export const ArtifactUploadTokenResponseDTO =
  ArtifactUploadTokenStatusResponseDTO.extend({ token: z.string().min(1) });
export type ArtifactUploadTokenResponseDTO = z.infer<
  typeof ArtifactUploadTokenResponseDTO
>;
