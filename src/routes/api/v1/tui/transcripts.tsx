import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import { requireTuiGateway } from "~/infra/tui";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";
import type { MessagingService } from "~/services/MessagingService";

export const Route = createFileRoute("/api/v1/tui/transcripts" as any)({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => {
          const rawGateway = getService<IWhatsAppMessagingGateway>(
            "IWhatsAppMessagingGateway",
          );
          const gateway = requireTuiGateway(rawGateway);
          if (gateway instanceof Response) {
            return gateway;
          }
          const url = new URL(request.url);
          const phoneNumber = url.searchParams.get("phoneNumber") ?? "";
          const messagingService =
            getService<MessagingService>("MessagingService");
          const transcripts =
            await messagingService.getTranscripts(phoneNumber);
          return new Response(JSON.stringify(transcripts), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      }),
  },
});
