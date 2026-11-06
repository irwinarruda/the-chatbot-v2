import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeCashFlowSearch } from "~/client/modules/cash-flow/parsers/CashFlowSearch";
import { CashFlowScreen } from "~/client/modules/cash-flow/screens/CashFlowScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/cash-flow")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
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
