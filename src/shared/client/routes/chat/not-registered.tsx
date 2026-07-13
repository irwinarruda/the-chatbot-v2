import { createFileRoute } from "@tanstack/react-router";
import { NotRegisteredScreen } from "~/modules/identity/client";

export const Route = createFileRoute("/chat/not-registered")({
  component: NotRegisteredScreen,
  head: () => ({
    meta: [{ title: "Not Registered - The Chatbot" }],
  }),
});
