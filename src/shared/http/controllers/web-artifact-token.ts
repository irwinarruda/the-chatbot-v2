import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toArtifactUploadTokenStatusResponse } from "~/modules/artifacts/contracts/ArtifactContractMapper";
import { ArtifactUploadTokenResponseDTO } from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/artifacts/token")({
  server: {
    handlers: {
      async GET({ context }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
        const status = await artifactService.getUploadTokenStatus(
          context.webAuth.userId,
        );
        return Http.json(toArtifactUploadTokenStatusResponse(status));
      },
      async POST({ context }) {
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
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
        const artifactService =
          ServerBootstrap.getApplication().services.artifacts;
        await artifactService.revokeUploadToken(context.webAuth.userId);
        return Http.ok();
      },
    },
  },
});
