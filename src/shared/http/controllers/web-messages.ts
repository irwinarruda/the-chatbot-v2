import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toChatMessagesResponse } from "~/modules/chat/contracts/ChatContractMapper";
import { SendWebMessageRequestDTO } from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { toMessageLocale } from "~/modules/chat/utils/MessageLoader";
import { streamWebChatResponse } from "~/shared/http/controllers/stream-web-chat-response";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

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
        return Http.json(
          toChatMessagesResponse(
            chat,
            messagingService.getSupportedReasoningEfforts(),
          ),
        );
      },
      async POST({ request, context }) {
        const messagingService =
          ServerBootstrap.getApplication().services.messaging;
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
