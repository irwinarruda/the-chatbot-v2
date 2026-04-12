import { getService } from "@infra/server-bootstrap";
import { requireTuiGateway } from "@infra/tui";
import { createFileRoute } from "@tanstack/react-router";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";

export const Route = createFileRoute("/api/v1/tui/stream")({
  server: {
    handlers: {
      async GET({ request }) {
        const rawGateway = getService<IWhatsAppMessagingGateway>(
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
                for await (const msg of gateway.getOutgoingMessages(
                  abortController.signal,
                )) {
                  const json = JSON.stringify(msg);
                  controller.enqueue(encoder.encode(`data: ${json}\n\n`));
                }
              } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                  // Expected when client disconnects
                } else {
                  console.error("SSE stream error:", err);
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
        return new Response(stream, {
          status: 200,
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
