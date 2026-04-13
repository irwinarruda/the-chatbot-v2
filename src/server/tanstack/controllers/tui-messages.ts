import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { requireTuiGateway } from "~/infra/tui";
import type { ReceiveTextMessageDTO } from "~/server/resources/IMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";
import { ChatType } from "~/shared/entities/enums/ChatType";

export const Route = createFileRoute("/api/v1/tui/messages")({
  server: {
    handlers: {
      async POST({ request }) {
        const rawGateway =
          ServerBootstrap.getService<IWhatsAppMessagingGateway>(
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
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const dto: ReceiveTextMessageDTO = {
          from: body.phone_number,
          text: body.text,
          chatType: ChatType.WhatsApp,
          idProvider: crypto.randomUUID(),
        };
        await messagingService.listenToMessage(dto);
        return Http.ok();
      },
    },
  },
});
