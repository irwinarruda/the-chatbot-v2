import { createFileRoute } from "@tanstack/react-router";
import { ArtifactUploadTokenResponseDTO } from "~/contracts/http/artifacts/artifact";
import { toArtifactUploadTokenStatusResponse } from "~/contracts/http/artifacts/artifact-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/web/artifacts/token")({
  server: {
    handlers: {
      async GET({ context }) {
        const artifactService = getServer().services.artifacts;
        const status = await artifactService.getUploadTokenStatus(
          context.webAuth.userId,
        );
        return Http.json(toArtifactUploadTokenStatusResponse(status));
      },
      async POST({ context }) {
        const artifactService = getServer().services.artifacts;
        const created = await artifactService.rotateUploadToken(
          context.webAuth.userId,
        );
        return Http.json(
          ArtifactUploadTokenResponseDTO.parse({
            ...toArtifactUploadTokenStatusResponse(created),
            token: created.token,
          }),
        );
      },
      async DELETE({ context }) {
        const artifactService = getServer().services.artifacts;
        await artifactService.revokeUploadToken(context.webAuth.userId);
        return Http.ok();
      },
    },
  },
});
