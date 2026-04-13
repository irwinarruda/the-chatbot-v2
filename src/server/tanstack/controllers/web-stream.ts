import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { WebChatEvent } from "~/server/resources/IWebMessagingGateway";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";

const encoder = new TextEncoder();
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

export const Route = createFileRoute("/api/v1/web/stream")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const streamAbort = createStreamAbortSignal(request.signal);
        const events = await messagingService.subscribeToWebEvents(
          context.webAuth.phoneNumber,
          streamAbort.signal,
        );
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encodeSseComment("connected"));
            void pumpEvents(events, controller);
          },
          cancel() {
            streamAbort.abort();
          },
        });
        return Http.stream(stream, { headers: SSE_HEADERS });
      },
    },
  },
});

async function pumpEvents(
  events: AsyncIterable<WebChatEvent>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  try {
    for await (const event of events) {
      controller.enqueue(encodeSseData(event));
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.error("Web SSE stream error:", error);
    }
  } finally {
    safelyCloseStream(controller);
  }
}

function createStreamAbortSignal(requestSignal: AbortSignal): AbortController {
  const abortController = new AbortController();
  requestSignal.addEventListener("abort", () => abortController.abort(), {
    once: true,
  });
  return abortController;
}

function encodeSseComment(comment: string): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}

function encodeSseData(event: WebChatEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function safelyCloseStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
): void {
  try {
    controller.close();
  } catch {}
}
