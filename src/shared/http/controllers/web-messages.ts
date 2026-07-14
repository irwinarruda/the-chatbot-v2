import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toChannelMessageResponse } from "~/modules/chat/contracts/ChatContractMapper";
import {
  ChatMessagesResponse,
  SendWebMessageRequest,
} from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ context }) {
        const messagingService =
          ServerBootstrap.getApplication().services.messaging;
        const chat = await messagingService.getChatByChannelAddress(
          context.webAuth.email,
          ChatChannel.Web,
        );
        if (!chat) {
          return Http.json({ messages: [] });
        }
        return Http.json(
          ChatMessagesResponse.parse({
            messages: chat.getChannelMessages().map(toChannelMessageResponse),
          }),
        );
      },
      async POST({ request, context }) {
        const messagingService =
          ServerBootstrap.getApplication().services.messaging;
        await messagingService.receiveWebMessage(
          context.webAuth.email,
          SendWebMessageRequest.parse(await request.json()),
        );
        return Http.ok();
      },
    },
  },
});
