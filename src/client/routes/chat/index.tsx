import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatScreen } from "~/client/modules/chat/screens/ChatScreen";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  component: ChatScreen,
  head: () => ({
    meta: [{ title: "Chat - The Chatbot" }],
  }),
});
