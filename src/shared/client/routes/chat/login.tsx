import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "~/modules/identity/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/chat/login")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (authResult.ok) {
      throw redirect({ to: "/chat" });
    }
  },
  component: LoginScreen,
  head: () => ({
    meta: [{ title: "Chat Login - The Chatbot" }],
  }),
});
