import { createFileRoute } from "@tanstack/react-router";
import { normalizeTodoSearch } from "~/client/modules/todos/parsers/TodoSearch";
import { TodoDetailScreen } from "~/client/modules/todos/screens/TodoDetailScreen";

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
