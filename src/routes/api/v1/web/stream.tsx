import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { IWebMessagingGateway } from "~/resources/IWebMessagingGateway";
import { WebAuth } from "~/utils/WebAuth";

export const Route = createFileRoute("/api/v1/web/stream")({
  server: {
    handlers: {
      async GET({ request }) {
        const auth = await WebAuth.requireAuth(request);
        const webGateway = ServerBootstrap.getService<IWebMessagingGateway>(
          "IWebMessagingGateway",
        );
        const abortController = new AbortController();
        request.signal.addEventListener("abort", () => {
          abortController.abort();
        });
        const encoder = new TextEncoder();
        let cancelled = false;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`: connected\n\n`));
            (async () => {
              try {
                for await (const event of webGateway.subscribe(
                  auth.phoneNumber,
                  abortController.signal,
                )) {
                  const json = JSON.stringify(event);
                  controller.enqueue(encoder.encode(`data: ${json}\n\n`));
                }
              } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                  // Expected when client disconnects
                } else {
                  console.error("Web SSE stream error:", err);
                }
              } finally {
                if (!cancelled) {
                  controller.close();
                }
              }
            })();
          },
          cancel() {
            cancelled = true;
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
