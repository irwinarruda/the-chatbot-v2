import { loadConfig } from "@infra/config";
import { getService } from "@infra/server-bootstrap";
import { requireWebAuth } from "@infra/web";
import { createFileRoute } from "@tanstack/react-router";
import { ChatType } from "~/entities/enums/ChatType";
import type {
  ReceiveInteractiveButtonMessageDTO,
  ReceiveTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ request }) {
        const config = loadConfig();
        const auth = await requireWebAuth(request, config);
        const messagingService =
          getService<MessagingService>("MessagingService");
        const chat = await messagingService.getChatByPhoneNumber(
          auth.phoneNumber,
        );
        if (!chat) {
          return Http.json({ messages: [] });
        }
        const messages = chat.messages.map((m) => ({
          id: m.id,
          type: m.type.toLowerCase(),
          userType: m.userType.toLowerCase(),
          text: m.text,
          buttonReply: m.buttonReply,
          buttonReplyOptions: m.buttonReplyOptions,
          mediaUrl: m.mediaUrl,
          mimeType: m.mimeType,
          transcript: m.transcript,
          createdAt: m.createdAt,
        }));
        return Http.json({ messages });
      },
      async POST({ request }) {
        const config = loadConfig();
        const auth = await requireWebAuth(request, config);
        const body = (await request.json()) as {
          text?: string;
          buttonReply?: string;
        };
        const messagingService =
          getService<MessagingService>("MessagingService");
        if (body.buttonReply) {
          const dto: ReceiveInteractiveButtonMessageDTO = {
            from: auth.phoneNumber,
            buttonReply: body.buttonReply,
            chatType: ChatType.Web,
            idProvider: crypto.randomUUID(),
          };
          await messagingService.listenToMessage(dto);
        } else {
          const dto: ReceiveTextMessageDTO = {
            from: auth.phoneNumber,
            text: body.text ?? "",
            chatType: ChatType.Web,
            idProvider: crypto.randomUUID(),
          };
          await messagingService.listenToMessage(dto);
        }
        return Http.json({ status: "ok" });
      },
    },
  },
});
