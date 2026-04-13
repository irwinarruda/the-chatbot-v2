import { loadConfig } from "@infra/config";
import { ValidationException } from "@infra/exceptions";
import { getService } from "@infra/server-bootstrap";
import { requireWebAuth } from "@infra/web";
import { createFileRoute } from "@tanstack/react-router";
import { ChatType } from "~/entities/enums/ChatType";
import type { ReceiveAudioMessageDTO } from "~/resources/IMessagingGateway";
import type { IWebMessagingGateway } from "~/resources/IWebMessagingGateway";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/audio")({
  server: {
    handlers: {
      async POST({ request }) {
        const config = loadConfig();
        const auth = await requireWebAuth(request, config);
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("audio/")) {
          throw new ValidationException(
            "Content-Type must be an audio type",
            "Provide a supported audio content type.",
          );
        }
        const buffer = Buffer.from(await request.arrayBuffer());
        const webGateway = getService<IWebMessagingGateway>(
          "IWebMessagingGateway",
        );
        const mediaId = await webGateway.saveMediaAsync(buffer);
        const messagingService =
          getService<MessagingService>("MessagingService");
        const dto: ReceiveAudioMessageDTO = {
          from: auth.phoneNumber,
          mimeType: contentType,
          mediaId,
          chatType: ChatType.Web,
          idProvider: crypto.randomUUID(),
        };
        await messagingService.listenToMessage(dto);
        return Http.json({ status: "ok", mediaId });
      },
    },
  },
});
