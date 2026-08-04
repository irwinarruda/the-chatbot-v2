import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  CashFlowScreen,
  normalizeCashFlowSearch,
} from "~/modules/cash-flow/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/cash-flow")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) throw redirect({ to: "/chat/login" });
  },
  validateSearch: normalizeCashFlowSearch,
  component: CashFlowRoute,
  head: () => ({ meta: [{ title: "Cash flow - The Chatbot" }] }),
});

function CashFlowRoute() {
  return <CashFlowScreen search={Route.useSearch()} />;
}
