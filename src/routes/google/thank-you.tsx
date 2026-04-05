import { createFileRoute } from "@tanstack/react-router";
import { ThankYouPage } from "~/components/pages/PublicPages";

export const Route = createFileRoute("/google/thank-you")({
  component: ThankYouRoute,
  head: () => ({
    meta: [{ title: "Obrigado - The Chatbot" }],
  }),
});

function ThankYouRoute() {
  return <ThankYouPage />;
}
