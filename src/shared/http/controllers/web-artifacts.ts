import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toArtifactSummaryResponse } from "~/modules/artifacts/contracts/ArtifactContractMapper";
import { ArtifactsResponseDTO } from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/artifacts")({
  server: {
    handlers: {
      async GET({ context }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
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
