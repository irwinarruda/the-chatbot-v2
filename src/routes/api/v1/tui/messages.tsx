import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import { requireTuiGateway } from "~/infra/tui";
import type {
  IWhatsAppMessagingGateway,
  ReceiveTextMessageDTO,
} from "~/resources/IWhatsAppMessagingGateway";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/tui/messages")({
  server: {
    handlers: {
      async POST({ request }) {
        const rawGateway = getService<IWhatsAppMessagingGateway>(
          "IWhatsAppMessagingGateway",
        );
        const gateway = requireTuiGateway(rawGateway);
        if (gateway instanceof Response) {
          return gateway;
        }
        const body = (await request.json()) as {
          text: string;
          phone_number: string;
        };
        const messagingService =
          getService<MessagingService>("MessagingService");
        const dto: ReceiveTextMessageDTO = {
          from: body.phone_number,
          text: body.text,
          idProvider: crypto.randomUUID(),
        };
        await messagingService.listenToMessage(dto);
        return Http.json({ status: "ok" });
      },
    },
  },
});
