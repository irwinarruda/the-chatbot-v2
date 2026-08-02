import { toChatMessagesResponse } from "~/modules/chat/contracts/ChatContractMapper";
import {
  type WebChatResponseEventDTO,
  WebChatResponseEventDTO as WebChatResponseEventSchema,
} from "~/modules/chat/entities/dtos/ChatDTO";
import type { MessagingService } from "~/modules/chat/services/MessagingService";
import type { MessageLocale } from "~/modules/chat/utils/MessageLoader";

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
