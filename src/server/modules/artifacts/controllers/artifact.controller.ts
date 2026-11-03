import { createFileRoute } from "@tanstack/react-router";
import {
  ArtifactIdDTO,
  PublishArtifactRequestDTO,
  PublishArtifactResponseDTO,
} from "~/contracts/http/artifacts/artifact";
import {
  toArtifactSummaryResponse,
  toArtifactViewerResponse,
} from "~/contracts/http/artifacts/artifact-mapper";
import { ARTIFACT_MAX_REQUEST_BYTES } from "~/domain/artifacts/artifact-limits";
import { getServer } from "~/server/production";
import { UnauthorizedException } from "~/server/shared/errors/application-errors";
import { requireBearerToken } from "~/server/shared/http/utils/bearer-token";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";
import { getWebAuthToken } from "~/server/shared/http/utils/web-auth-cookie";

export const Route = createFileRoute("/api/v1/artifacts/$artifactId")({
  server: {
    handlers: {
      async GET({ request, params }) {
        const application = getServer();
        const viewerUserId = await getOptionalViewerUserId(request);
        const artifactId = ArtifactIdDTO.parse(params.artifactId);
        const artifact =
          await application.services.artifacts.getArtifactForViewer(
            artifactId,
            viewerUserId,
          );
        return Http.json(toArtifactViewerResponse(artifact), {
          headers: { "Cache-Control": "private, no-store" },
        });
      },
      async PUT({ request, params }) {
        const artifactService = getServer().services.artifacts;
        const artifactId = ArtifactIdDTO.parse(params.artifactId);
        const idUser = await artifactService.authenticateUploadToken(
          requireBearerToken(request),
        );
        const body = PublishArtifactRequestDTO.parse(
          await parseJsonRequest(request, {
            maxBytes: ARTIFACT_MAX_REQUEST_BYTES,
          }),
        );
        const artifact = await artifactService.replaceArtifact(
          idUser,
          artifactId,
          body,
        );
        const url = new URL(`/a/${artifact.id}`, request.url).href;
        return Http.json(
          PublishArtifactResponseDTO.parse({
            artifact: toArtifactSummaryResponse(artifact),
            url,
          }),
        );
      },
    },
  },
});

async function getOptionalViewerUserId(
  request: Request,
): Promise<string | undefined> {
  const token = getWebAuthToken(request);
  if (!token) return undefined;
  try {
    const user = await getServer().services.auth.authenticateWebUser(token);
    return user.id;
  } catch (error) {
    if (error instanceof UnauthorizedException) return undefined;
    throw error;
  }
}
