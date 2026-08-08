import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";
import { normalizeTodoSearch, TodoScreen } from "~/modules/todos/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/todo")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  validateSearch: normalizeTodoSearch,
  component: TodoRoute,
  head: () => ({
    meta: [{ title: "Todos - The Chatbot" }],
  }),
});

function TodoRoute() {
  return <TodoScreen search={Route.useSearch()} />;
}
