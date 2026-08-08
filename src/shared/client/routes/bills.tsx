import { createFileRoute, redirect } from "@tanstack/react-router";
import { BillsScreen, normalizeBillsSearch } from "~/modules/cash-flow/client";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

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
