import { createFileRoute } from "@tanstack/react-router";
import { ValidationException } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/web/audio")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("audio/")) {
          throw new ValidationException(
            "Content-Type must be an audio type",
            "Provide a supported audio content type.",
          );
        }
        const buffer = Buffer.from(await request.arrayBuffer());
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        await messagingService.receiveWebMessage(context.webAuth.phoneNumber, {
          audioBuffer: buffer,
          mimeType: contentType,
        });
        return Http.ok();
      },
    },
  },
});
