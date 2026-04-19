import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { requireTuiGateway } from "~/infra/tui";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/tui/stream")({
  server: {
    handlers: {
      async GET({ request }) {
        const rawGateway =
          ServerBootstrap.getService<IWhatsAppMessagingGateway>(
            "IWhatsAppMessagingGateway",
          );
        const gateway = requireTuiGateway(rawGateway);
        if (gateway instanceof Response) {
          return gateway;
        }
        const abortController = new AbortController();
        request.signal.addEventListener("abort", () => {
          abortController.abort();
        });
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`: connected\n\n`));
            (async () => {
              try {
                for await (const message of gateway.getOutgoingMessages(
                  abortController.signal,
                )) {
                  const json = JSON.stringify(message);
                  controller.enqueue(encoder.encode(`data: ${json}\n\n`));
                }
              } catch (error) {
                if (
                  error instanceof DOMException &&
                  error.name === "AbortError"
                ) {
                } else {
                  console.error("SSE stream error:", error);
                }
              } finally {
                controller.close();
              }
            })();
          },
          cancel() {
            abortController.abort();
          },
        });
        return Http.stream(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
