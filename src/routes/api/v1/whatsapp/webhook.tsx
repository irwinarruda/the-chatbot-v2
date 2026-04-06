import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { MessagingService } from "~/services/MessagingService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/whatsapp/webhook")({
  server: {
    handlers: {
      async GET({ request }) {
        const messagingService =
          getService<MessagingService>("MessagingService");
        const url = new URL(request.url);
        const hubMode = url.searchParams.get("hub.mode") ?? "";
        const hubChallenge = url.searchParams.get("hub.challenge") ?? "";
        const hubVerifyToken = url.searchParams.get("hub.verify_token") ?? "";
        messagingService.validateWebhook(hubMode, hubVerifyToken);
        return Http.text(hubChallenge);
      },
      async POST({ request }) {
        const messagingService =
          getService<MessagingService>("MessagingService");
        const xHubSignature256 =
          request.headers.get("x-hub-signature-256") ?? "";
        const stringifiedBody = await request.text();
        await messagingService.receiveMessage(
          stringifiedBody,
          xHubSignature256,
        );
        return Http.json(null);
      },
    },
  },
});
