import { createFileRoute, redirect } from "@tanstack/react-router";
import { BillsScreen } from "~/modules/cash-flow/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/bills")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) throw redirect({ to: "/chat/login" });
  },
  component: BillsScreen,
  head: () => ({
    meta: [{ title: "Monthly bills - The Chatbot" }],
  }),
});
