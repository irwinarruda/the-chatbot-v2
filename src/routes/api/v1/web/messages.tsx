import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";
import { WebAuth } from "~/utils/WebAuth";

export const Route = createFileRoute("/api/v1/web/messages")({
  server: {
    handlers: {
      async GET({ request }) {
        const auth = await WebAuth.requireAuth(request);
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const chat = await messagingService.getChatByPhoneNumber(
          auth.phoneNumber,
        );
        if (!chat) {
          return Http.json({ messages: [] });
        }
        const messages = chat.messages.map((m) => ({
          id: m.id,
          type: m.type,
          userType: m.userType,
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
        const auth = await WebAuth.requireAuth(request);
        const body = await request.json();
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        await messagingService.receiveWebMessage(auth.phoneNumber, body);
        return Http.json({ status: "ok" });
      },
    },
  },
});
