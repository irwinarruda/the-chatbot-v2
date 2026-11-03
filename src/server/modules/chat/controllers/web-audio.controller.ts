import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toMessageLocale } from "~/domain/chat/message-locale";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { streamWebChatResponse } from "./stream-web-chat-response.controller";

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
        const messagingService = getServer().services.messaging;
        return streamWebChatResponse(
          messagingService,
          context.webAuth.email,
          {
            audioBuffer: buffer,
            mimeType: contentType,
            clientMessageId,
          },
          toMessageLocale(context.prefs.locale),
        );
      },
    },
  },
});
