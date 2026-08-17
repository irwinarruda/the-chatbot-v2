import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toArtifactSummaryResponse } from "~/modules/artifacts/contracts/ArtifactContractMapper";
import {
  PublishArtifactRequestDTO,
  PublishArtifactResponseDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { ARTIFACT_MAX_REQUEST_BYTES } from "~/modules/artifacts/utils/ArtifactLimits";
import { requireBearerToken } from "~/shared/http/utils/BearerToken";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/artifacts")({
  server: {
    handlers: {
      async POST({ request }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
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
