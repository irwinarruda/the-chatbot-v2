import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeTodoSearch } from "~/client/modules/todos/parsers/TodoSearch";
import { TodoScreen } from "~/client/modules/todos/screens/TodoScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/todo")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
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
