import { createFileRoute } from "@tanstack/react-router";
import {
  PublishArtifactRequestDTO,
  PublishArtifactResponseDTO,
} from "~/contracts/http/artifacts/artifact";
import { toArtifactSummaryResponse } from "~/contracts/http/artifacts/artifact-mapper";
import { ARTIFACT_MAX_REQUEST_BYTES } from "~/domain/artifacts/artifact-limits";
import { getServer } from "~/server/production";
import { requireBearerToken } from "~/server/shared/http/utils/bearer-token";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/artifacts")({
  server: {
    handlers: {
      async POST({ request }) {
        const artifactService = getServer().services.artifacts;
        const idUser = await artifactService.authenticateUploadToken(
          requireBearerToken(request),
        );
        const body = PublishArtifactRequestDTO.parse(
          await parseJsonRequest(request, {
            maxBytes: ARTIFACT_MAX_REQUEST_BYTES,
          }),
        );
        const artifact = await artifactService.publishArtifact(idUser, body);
        const url = new URL(`/a/${artifact.id}`, request.url).href;
        return Http.json(
          PublishArtifactResponseDTO.parse({
            artifact: toArtifactSummaryResponse(artifact),
            url,
          }),
          { status: 201 },
        );
      },
    },
  },
});
