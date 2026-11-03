import { createFileRoute } from "@tanstack/react-router";
import { SendWebMessageRequestDTO } from "~/contracts/http/chat/chat";
import { toChatMessagesResponse } from "~/contracts/http/chat/chat-mapper";
import { ChatChannel } from "~/domain/chat/chat-channel";
import { toMessageLocale } from "~/domain/chat/message-locale";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";
import { streamWebChatResponse } from "./stream-web-chat-response.controller";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ context }) {
        const messagingService = getServer().services.messaging;
        const chat = await messagingService.getChatByChannelAddress(
          context.webAuth.email,
          ChatChannel.Web,
        );
        return Http.json(
          toChatMessagesResponse(
            chat,
            await messagingService.getModelConfiguration(
              context.webAuth.userId,
            ),
          ),
        );
      },
      async POST({ request, context }) {
        const messagingService = getServer().services.messaging;
        const body = SendWebMessageRequestDTO.parse(
          await parseJsonRequest(request),
        );
        return streamWebChatResponse(
          messagingService,
          context.webAuth.email,
          body,
          toMessageLocale(context.prefs.locale),
        );
      },
    },
  },
});
