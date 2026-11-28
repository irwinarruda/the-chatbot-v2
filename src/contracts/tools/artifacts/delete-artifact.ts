import { z } from "zod";
import { ArtifactIdDTO } from "~/contracts/http/artifacts/artifact";

export const DeleteArtifactToolDTO = z.object({
  artifact_id: ArtifactIdDTO.describe(
    "Exact artifact ID returned by list_artifacts or publish_artifact",
  ),
});

export type DeleteArtifactToolDTO = z.infer<typeof DeleteArtifactToolDTO>;
