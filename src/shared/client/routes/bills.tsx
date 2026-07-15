import { createFileRoute, redirect } from "@tanstack/react-router";
import { BillsScreen, normalizeBillsSearch } from "~/modules/cash-flow/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/bills")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) throw redirect({ to: "/chat/login" });
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
