import {
  type WebChatResponseEventDTO,
  WebChatResponseEventDTO as WebChatResponseEventSchema,
} from "~/contracts/http/chat/chat";
import { toChatMessagesResponse } from "~/contracts/http/chat/chat-mapper";
import type { MessageLocale } from "~/domain/chat/message-locale";
import type { MessagingService } from "~/server/modules/chat/services/messaging.service";

const defaultHeartbeatMs = 15_000;

export function streamWebChatResponse(
  messagingService: Pick<
    MessagingService,
    "receiveWebMessage" | "getModelConfiguration"
  >,
  webAddress: string,
  body: unknown,
  locale: MessageLocale,
  heartbeatMs: number = defaultHeartbeatMs,
): Response {
  const encoder = new TextEncoder();
  let isClosed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function write(line: string) {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`${line}\n`));
        } catch {
          isClosed = true;
        }
      }
      function enqueue(event: WebChatResponseEventDTO) {
        if (isClosed) return;
        write(JSON.stringify(WebChatResponseEventSchema.parse(event)));
      }
      heartbeat = setInterval(() => write(""), heartbeatMs);
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
          clearInterval(heartbeat);
          if (!isClosed) {
            isClosed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      isClosed = true;
      clearInterval(heartbeat);
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
