import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeCashFlowConnectSearch } from "~/client/modules/cash-flow/parsers/CashFlowConnectSearch";
import { CashFlowConnectScreen } from "~/client/modules/cash-flow/screens/CashFlowConnectScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/cash-flow/connect")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  validateSearch: normalizeCashFlowConnectSearch,
  component: CashFlowConnectRoute,
  head: () => ({ meta: [{ title: "Connect spreadsheet - The Chatbot" }] }),
});

function CashFlowConnectRoute() {
  return <CashFlowConnectScreen search={Route.useSearch()} />;
}
