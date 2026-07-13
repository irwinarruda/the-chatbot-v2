import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TodoDetailDialog } from "~/modules/todos/client/components/TodoDetailDialog";
import type { TodoSearch } from "~/modules/todos/client/TodoSearch";
import type { TodoStatus } from "~/modules/todos/contracts/TodoContracts";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

export function TodoDetailScreen({
  search,
  todoId,
}: {
  search: TodoSearch;
  todoId: string;
}) {
  const navigate = useNavigate();
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
