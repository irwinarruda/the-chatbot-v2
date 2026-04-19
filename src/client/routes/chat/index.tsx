import { ChatPage } from "~/client/components/pages/ChatPage";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireChatAccess } from "~/server/tanstack/functions/require-chat-access";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async () => {
    const authResult = await requireChatAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/chat/login",
      });
    }
  },
  component: ChatRoute,
  head: () => ({
    meta: [{ title: "Chat - The Chatbot" }],
  }),
});

function ChatRoute() {
  return <ChatPage />;
}
