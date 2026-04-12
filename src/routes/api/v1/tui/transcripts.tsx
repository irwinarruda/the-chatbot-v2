import { getService } from "@infra/server-bootstrap";
import { requireTuiGateway } from "@infra/tui";
import { createFileRoute } from "@tanstack/react-router";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/tui/transcripts")({
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
        const url = new URL(request.url);
        const phoneNumber = url.searchParams.get("phoneNumber") ?? "";
        const messagingService =
          getService<MessagingService>("MessagingService");
        const transcripts = await messagingService.getTranscripts(phoneNumber);
        return Http.json(transcripts);
      },
    },
  },
});
