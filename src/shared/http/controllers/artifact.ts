import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import {
  toArtifactSummaryResponse,
  toArtifactViewerResponse,
} from "~/modules/artifacts/contracts/ArtifactContractMapper";
import {
  ArtifactIdDTO,
  PublishArtifactRequestDTO,
  PublishArtifactResponseDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { ARTIFACT_MAX_REQUEST_BYTES } from "~/modules/artifacts/utils/ArtifactLimits";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { requireBearerToken } from "~/shared/http/utils/BearerToken";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";
import { getWebAuthToken } from "~/shared/http/utils/WebAuthCookie";

export const Route = createFileRoute("/api/v1/artifacts/$artifactId")({
  server: {
    handlers: {
      async GET({ request, params }) {
        const application = ServerBootstrap.getApplication();
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
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
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
    const user =
      await ServerBootstrap.getApplication().services.auth.authenticateWebUser(
        token,
      );
    return user.id;
  } catch (error) {
    if (error instanceof UnauthorizedException) return undefined;
    throw error;
  }
}
