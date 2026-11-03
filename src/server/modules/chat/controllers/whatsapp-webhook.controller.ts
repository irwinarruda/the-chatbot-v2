import { createFileRoute } from "@tanstack/react-router";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/whatsapp/webhook")({
  server: {
    handlers: {
      async GET({ request }) {
        const messagingService = getServer().services.messaging;
        const url = new URL(request.url);
        const hubMode = url.searchParams.get("hub.mode") ?? "";
        const hubChallenge = url.searchParams.get("hub.challenge") ?? "";
        const hubVerifyToken = url.searchParams.get("hub.verify_token") ?? "";
        messagingService.validateWebhook(hubMode, hubVerifyToken);
        return Http.text(hubChallenge);
      },
      async POST({ request }) {
        const messagingService = getServer().services.messaging;
        const xHubSignature256 =
          request.headers.get("x-hub-signature-256") ?? "";
        const stringifiedBody = await request.text();
        await messagingService.receiveWhatsAppMessage(
          stringifiedBody,
          xHubSignature256,
        );
        return Http.json(undefined);
      },
    },
  },
});
