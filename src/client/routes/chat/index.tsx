import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatScreen } from "~/client/modules/chat/screens/ChatScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
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
