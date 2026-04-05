import { createFileRoute } from "@tanstack/react-router";
import { AlreadySignedInPage } from "~/components/pages/PublicPages";

export const Route = createFileRoute("/google/already-signed-in")({
  component: AlreadySignedInRoute,
  head: () => ({
    meta: [{ title: "Conectado - The Chatbot" }],
  }),
});

function AlreadySignedInRoute() {
  return <AlreadySignedInPage />;
}
