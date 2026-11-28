import { z } from "zod";
import { PublishArtifactRequestDTO } from "~/contracts/http/artifacts/artifact";

export const PublishArtifactToolDTO = z.object({
  title: PublishArtifactRequestDTO.shape.title.describe(
    "Short page title, at most 160 characters",
  ),
  html: PublishArtifactRequestDTO.shape.html.describe(
    "Complete self-contained HTML document, at most 1 MiB",
  ),
  visibility: PublishArtifactRequestDTO.shape.visibility.describe(
    "private (only the owner, signed in) or public (anyone with the link). Defaults to private",
  ),
});

export type PublishArtifactToolDTO = z.infer<typeof PublishArtifactToolDTO>;
