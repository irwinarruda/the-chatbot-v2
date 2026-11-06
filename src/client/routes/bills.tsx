import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeBillsSearch } from "~/client/modules/cash-flow/parsers/BillsSearch";
import { BillsScreen } from "~/client/modules/cash-flow/screens/BillsScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/bills")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  validateSearch: normalizeBillsSearch,
  component: BillsRoute,
  head: () => ({
    meta: [{ title: "Monthly bills - The Chatbot" }],
  }),
});

function BillsRoute() {
  return <BillsScreen search={Route.useSearch()} />;
}
