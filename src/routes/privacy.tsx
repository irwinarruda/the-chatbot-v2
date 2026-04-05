import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicyPage } from "~/components/pages/PublicPages";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: () => ({
    meta: [{ title: "Política de Privacidade - The Chatbot" }],
  }),
});

function PrivacyRoute() {
  return <PrivacyPolicyPage />;
}
