import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeTodoSearch } from "~/client/modules/todos/parsers/TodoSearch";
import { TodoScreen } from "~/client/modules/todos/screens/TodoScreen";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

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
