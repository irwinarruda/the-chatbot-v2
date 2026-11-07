import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TodoDetailDialog } from "~/client/modules/todos/components/TodoDetailDialog";
import type { TodoSearch } from "~/client/modules/todos/parsers/TodoSearch";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { TodoStatusDTO } from "~/contracts/http/todos/todo";

export function TodoDetailScreen({
  search,
  todoId,
}: {
  search: TodoSearch;
  todoId: string;
}) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const selectedTodo = useApp((s) => s.selectedTodo);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
  const closeTodo = useApp((state) => state.closeTodo);
  const loadTodo = useApp((s) => s.loadTodo);
  const updateTodo = useApp((s) => s.updateTodo);
  const deleteTodo = useApp((s) => s.deleteTodo);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.todoPage;
  const todo = selectedTodo?.id === todoId ? selectedTodo : undefined;

  function onCloseDialog() {
    navigate({ to: "/todo", search });
  }

  async function onSaveTodo(patch: {
    name: string;
    description: string;
    dueDate: string | null;
    status: TodoStatusDTO;
  }) {
    if (!todo) return;
    await updateTodo(todo.id, patch);
  }

  async function onDeleteTodo() {
    if (!todo) return;
    const deleted = await deleteTodo(todo.id);
    if (deleted) onCloseDialog();
  }

  useEffect(() => {
    void loadTodo(todoId);
    return closeTodo;
  }, [todoId, loadTodo, closeTodo]);

  return (
    <TodoDetailDialog
      isSubmitting={isTodoSubmitting}
      mode="edit"
      onClose={onCloseDialog}
      onDelete={onDeleteTodo}
      onSave={onSaveTodo}
      open={Boolean(todoId)}
      t={t}
      todo={todo}
    />
  );
}
