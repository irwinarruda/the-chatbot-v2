import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeBillsSearch } from "~/client/modules/cash-flow/parsers/BillsSearch";
import { BillsScreen } from "~/client/modules/cash-flow/screens/BillsScreen";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

export const Route = createFileRoute("/bills")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
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
