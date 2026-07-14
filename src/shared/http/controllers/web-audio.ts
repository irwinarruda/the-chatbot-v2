import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toChatMessagesResponse } from "~/modules/chat/contracts/ChatContractMapper";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";

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
        const clientMessageId = z
          .string()
          .uuid()
          .parse(request.headers.get("x-client-message-id"));
        const messagingService =
          ServerBootstrap.getApplication().services.messaging;
        const chat = await messagingService.receiveWebMessage(
          context.webAuth.email,
          {
            audioBuffer: buffer,
            mimeType: contentType,
            clientMessageId,
          },
        );
        return Http.json(toChatMessagesResponse(chat));
      },
    },
  },
});
