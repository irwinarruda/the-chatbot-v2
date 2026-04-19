import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";
import type { SharedChatMessage } from "~/shared/types/web-chat";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ context }) {
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const chat = await messagingService.getChatByPhoneNumber(
          context.webAuth.phoneNumber,
        );
        if (!chat) {
          return Http.json({ messages: [] });
        }
        const messages: SharedChatMessage[] = chat.messages.map((message) =>
          message.toJSON(),
        );
        return Http.json({ messages });
      },
      async POST({ request, context }) {
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        await messagingService.receiveWebMessage(
          context.webAuth.phoneNumber,
          await request.json(),
        );
        return Http.ok();
      },
    },
  },
});
