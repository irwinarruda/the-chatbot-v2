import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TodoDetailDialog } from "~/client/components/TodoDetailDialog";
import { getDictionary } from "~/client/i18n";
import { usePrefs } from "~/client/providers/usePrefs";
import { useApp } from "~/client/stores";
import type { TodoStatus } from "~/modules/todos/contracts/TodoContracts";
import { normalizeTodoSearch } from "../todo";

export const Route = createFileRoute("/todo/$todoId")({
  validateSearch: normalizeTodoSearch,
  component: TodoDetailRoute,
  head: () => ({
    meta: [{ title: "Todo - The Chatbot" }],
  }),
});

function TodoDetailRoute() {
  const { todoId } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const prefs = usePrefs();
  const todos = useApp((s) => s.todos);
  const selectedTodo = useApp((s) => s.selectedTodo);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
  const loadTodo = useApp((s) => s.loadTodo);
  const updateTodo = useApp((s) => s.updateTodo);
  const deleteTodo = useApp((s) => s.deleteTodo);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.todoPage;

  function onCloseDialog() {
    navigate({ to: "/todo", search });
  }

  async function onSaveTodo(patch: {
    name: string;
    description: string;
    dueDate?: string;
    status: TodoStatus;
  }) {
    if (!selectedTodo) return;
    await updateTodo(selectedTodo.id, patch);
  }

  async function onDeleteTodo() {
    if (!selectedTodo) return;
    await deleteTodo(selectedTodo.id);
    onCloseDialog();
  }

  useEffect(() => {
    void loadTodo(todoId);
  }, [todoId, todos.length]);

  return (
    <TodoDetailDialog
      isSubmitting={isTodoSubmitting}
      onClose={onCloseDialog}
      onDelete={onDeleteTodo}
      onSave={onSaveTodo}
      open={Boolean(todoId)}
      t={t}
      todo={selectedTodo}
    />
  );
}
