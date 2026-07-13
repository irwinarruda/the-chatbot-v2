import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeTodoSearch, TodoScreen } from "~/modules/todos/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/todo")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({ to: "/chat/login" });
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
