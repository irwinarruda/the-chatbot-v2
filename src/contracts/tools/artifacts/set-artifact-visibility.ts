import { z } from "zod";
import {
  ArtifactIdDTO,
  ArtifactVisibilityDTO,
} from "~/contracts/http/artifacts/artifact";

export const SetArtifactVisibilityToolDTO = z.object({
  artifact_id: ArtifactIdDTO.describe(
    "Exact artifact ID returned by list_artifacts or publish_artifact",
  ),
  visibility: ArtifactVisibilityDTO.describe(
    "private (only the owner, signed in) or public (anyone with the link)",
  ),
});

export type SetArtifactVisibilityToolDTO = z.infer<
  typeof SetArtifactVisibilityToolDTO
>;
