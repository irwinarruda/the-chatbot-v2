import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatScreen } from "~/modules/chat/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({ to: "/chat/login" });
    }
  },
  component: ChatScreen,
  head: () => ({
    meta: [{ title: "Chat - The Chatbot" }],
  }),
});
