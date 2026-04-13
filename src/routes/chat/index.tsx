import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "~/components/pages/ChatPage";

export const Route = createFileRoute("/chat/")({
  component: ChatRoute,
  head: () => ({
    meta: [{ title: "Chat - The Chatbot" }],
  }),
});

function ChatRoute() {
  return <ChatPage />;
}
