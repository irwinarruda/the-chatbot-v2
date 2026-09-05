import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TodoDetailDialog } from "~/modules/todos/client/components/TodoDetailDialog";
import type { TodoSearch } from "~/modules/todos/client/TodoSearch";
import type { TodoStatusDTO } from "~/modules/todos/entities/dtos/TodoDTO";
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
  const selectedTodo = useApp((s) => s.selectedTodo);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
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
  }, [todoId, loadTodo]);

  return (
    <TodoDetailDialog
      isSubmitting={isTodoSubmitting}
      mode="edit"
      onClose={onCloseDialog}
      onDelete={onDeleteTodo}
      onSave={onSaveTodo}
      open={Boolean(todoId)}
      t={t}
      theme={prefs.theme}
      todo={todo}
    />
  );
}
