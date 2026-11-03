import { z } from "zod";

export const ArtifactViolationDTO = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ArtifactViolationDTO = z.infer<typeof ArtifactViolationDTO>;

export const ArtifactValidationDetailsDTO = z.object({
  violations: z.array(ArtifactViolationDTO).min(1),
});
export type ArtifactValidationDetailsDTO = z.infer<
  typeof ArtifactValidationDetailsDTO
>;
