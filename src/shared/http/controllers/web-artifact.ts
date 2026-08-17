import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toArtifactSummaryResponse } from "~/modules/artifacts/contracts/ArtifactContractMapper";
import {
  ArtifactIdDTO,
  ArtifactSummaryResponseDTO,
  ChangeArtifactVisibilityRequestDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/artifacts/$artifactId")({
  server: {
    handlers: {
      async PATCH({ request, context, params }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
        const artifactId = ArtifactIdDTO.parse(params.artifactId);
        const body = ChangeArtifactVisibilityRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const artifact = await artifactService.changeVisibility(
          context.webAuth.userId,
          artifactId,
          body.visibility,
        );
        return Http.json(
          ArtifactSummaryResponseDTO.parse(toArtifactSummaryResponse(artifact)),
        );
      },
      async DELETE({ context, params }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
        const artifactId = ArtifactIdDTO.parse(params.artifactId);
        await artifactService.deleteArtifact(
          context.webAuth.userId,
          artifactId,
        );
        return Http.ok();
      },
    },
  },
});
