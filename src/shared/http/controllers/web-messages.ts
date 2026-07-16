import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toChatMessagesResponse } from "~/modules/chat/contracts/ChatContractMapper";
import { SendWebMessageRequestDTO } from "~/modules/chat/entities/dtos/ChatDTO";
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
        return Http.json(toChatMessagesResponse(chat));
      },
      async POST({ request, context }) {
        const messagingService =
          ServerBootstrap.getApplication().services.messaging;
        const chat = await messagingService.receiveWebMessage(
          context.webAuth.email,
          SendWebMessageRequestDTO.parse(await request.json()),
        );
        return Http.json(toChatMessagesResponse(chat));
      },
    },
  },
});
