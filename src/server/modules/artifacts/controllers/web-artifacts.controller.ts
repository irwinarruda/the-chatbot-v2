import { createFileRoute } from "@tanstack/react-router";
import { ArtifactsResponseDTO } from "~/contracts/http/artifacts/artifact";
import { toArtifactSummaryResponse } from "~/contracts/http/artifacts/artifact-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/web/artifacts")({
  server: {
    handlers: {
      async GET({ context }) {
        const artifactService = getServer().services.artifacts;
        const artifacts = await artifactService.listArtifacts(
          context.webAuth.userId,
        );
        return Http.json(
          ArtifactsResponseDTO.parse({
            artifacts: artifacts.map(toArtifactSummaryResponse),
          }),
        );
      },
    },
  },
});
