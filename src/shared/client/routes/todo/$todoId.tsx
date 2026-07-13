import { createFileRoute } from "@tanstack/react-router";
import { normalizeTodoSearch, TodoDetailScreen } from "~/modules/todos/client";

export const Route = createFileRoute("/todo/$todoId")({
  validateSearch: normalizeTodoSearch,
  component: TodoDetailRoute,
  head: () => ({
    meta: [{ title: "Todo - The Chatbot" }],
  }),
});

function TodoDetailRoute() {
  return (
    <TodoDetailScreen
      search={Route.useSearch()}
      todoId={Route.useParams().todoId}
    />
  );
}
