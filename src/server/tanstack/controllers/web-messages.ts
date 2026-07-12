import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";
import type { ChatMessageDTO } from "~/shared/entities/dtos/ChatMessageDTO";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ context }) {
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const chat = await messagingService.getChatByChannelAddress(
          context.webAuth.email,
          ChatChannel.Web,
        );
        if (!chat) {
          return Http.json({ messages: [] });
        }
        const messages: ChatMessageDTO[] = chat
          .getChannelMessages()
          .map((message) => message.toJSON());
        return Http.json({ messages });
      },
      async POST({ request, context }) {
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        await messagingService.receiveWebMessage(
          context.webAuth.email,
          await request.json(),
        );
        return Http.ok();
      },
    },
  },
});
