import { createFileRoute } from "@tanstack/react-router";
import { WelcomePage } from "~/components/pages/PublicPages";

export const Route = createFileRoute("/")({
  component: IndexRoute,
  head: () => ({
    meta: [{ title: "Bem-vindo - The Chatbot" }],
  }),
});

function IndexRoute() {
  return <WelcomePage />;
}
