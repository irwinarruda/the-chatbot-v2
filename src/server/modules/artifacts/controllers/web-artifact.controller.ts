import { createFileRoute } from "@tanstack/react-router";
import {
  ArtifactIdDTO,
  ArtifactSummaryResponseDTO,
  ChangeArtifactVisibilityRequestDTO,
} from "~/contracts/http/artifacts/artifact";
import { toArtifactSummaryResponse } from "~/contracts/http/artifacts/artifact-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/artifacts/$artifactId")({
  server: {
    handlers: {
      async PATCH({ request, context, params }) {
        const artifactService = getServer().services.artifacts;
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
        const artifactService = getServer().services.artifacts;
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
