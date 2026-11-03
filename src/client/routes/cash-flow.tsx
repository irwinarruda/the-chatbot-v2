import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeCashFlowSearch } from "~/client/modules/cash-flow/parsers/CashFlowSearch";
import { CashFlowScreen } from "~/client/modules/cash-flow/screens/CashFlowScreen";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

export const Route = createFileRoute("/cash-flow")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  validateSearch: normalizeCashFlowSearch,
  component: CashFlowRoute,
  head: () => ({ meta: [{ title: "Cash flow - The Chatbot" }] }),
});

function CashFlowRoute() {
  return <CashFlowScreen search={Route.useSearch()} />;
}
