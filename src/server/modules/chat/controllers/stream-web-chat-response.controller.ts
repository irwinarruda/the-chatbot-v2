import {
  type WebChatResponseEventDTO,
  WebChatResponseEventDTO as WebChatResponseEventSchema,
} from "~/contracts/http/chat/chat";
import { toChatMessagesResponse } from "~/contracts/http/chat/chat-mapper";
import type { MessageLocale } from "~/domain/chat/message-locale";
import type { MessagingService } from "~/server/modules/chat/services/messaging.service";

export function streamWebChatResponse(
  messagingService: MessagingService,
  webAddress: string,
  body: unknown,
  locale: MessageLocale,
): Response {
  const encoder = new TextEncoder();
  let isClosed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function enqueue(event: WebChatResponseEventDTO) {
        if (isClosed) return;
        const parsed = WebChatResponseEventSchema.parse(event);
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(parsed)}\n`));
        } catch {
          isClosed = true;
        }
      }
      void (async () => {
        try {
          const chat = await messagingService.receiveWebMessage(
            webAddress,
            body,
            enqueue,
            locale,
          );
          enqueue({
            type: "snapshot",
            chat: toChatMessagesResponse(
              chat,
              await messagingService.getModelConfiguration(chat?.idUser),
            ),
          });
        } catch {
          enqueue({
            type: "error",
            message: "The chat response could not be completed.",
          });
        } finally {
          if (!isClosed) {
            isClosed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      isClosed = true;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
