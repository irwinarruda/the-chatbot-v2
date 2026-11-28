import type { z } from "zod";
import {
  ArtifactIdDTO,
  ArtifactVisibilityDTO,
} from "~/contracts/http/artifacts/artifact";
import { PublishArtifactToolDTO } from "~/contracts/tools/artifacts/publish-artifact";

export const ReplaceArtifactToolDTO = PublishArtifactToolDTO.extend({
  artifact_id: ArtifactIdDTO.describe(
    "Exact artifact ID returned by list_artifacts or publish_artifact",
  ),
  visibility: ArtifactVisibilityDTO.describe(
    "private or public. Omit it to keep the artifact's current visibility",
  ).optional(),
});

export type ReplaceArtifactToolDTO = z.infer<typeof ReplaceArtifactToolDTO>;
