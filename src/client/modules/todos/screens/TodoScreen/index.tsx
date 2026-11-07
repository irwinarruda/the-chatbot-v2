import { Outlet, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ListTodo, Plus, SearchX, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TodoErrorCode } from "~/client/modules/todos/app/services/TodoService";
import { TodoDetailDialog } from "~/client/modules/todos/components/TodoDetailDialog";
import { compareTodosByUrgency } from "~/client/modules/todos/parsers/TodoDueDate";
import {
  DEFAULT_TODO_STATUS,
  type TodoSearch,
  toTodoRouteSearch,
} from "~/client/modules/todos/parsers/TodoSearch";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { TodoStatusDTO } from "~/contracts/http/todos/todo";
import { TodoFilters, type TodoFilterValues } from "./TodoFilters";
import { TodoRow } from "./TodoRow";

const loadingRows = ["first", "second", "third"];

export function TodoScreen({ search }: { search: TodoSearch }) {
  const navigate = useNavigate();
  const resetFeature = useApp((state) => state.resetTodos);
  const prefs = usePrefs();
  const todos = useApp((s) => s.todos);
  const todoError = useApp((s) => s.todoError);
  const isTodoBootstrapping = useApp((s) => s.isTodoBootstrapping);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
  const bootstrapTodos = useApp((s) => s.bootstrapTodos);
  const createTodo = useApp((s) => s.createTodo);
  const updateTodo = useApp((s) => s.updateTodo);
  const clearTodoError = useApp((s) => s.clearTodoError);
  const [createName, setCreateName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.todoPage;
  const filters: TodoFilterValues = {
    q: search.q ?? "",
    dueDate: search.dueDate ?? "",
    due: search.due ?? "all",
    status: search.status ?? DEFAULT_TODO_STATUS,
  };
  const errorMessages: Record<TodoErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    deleting: t.errorDeleting,
  };
  const todoErrorMessage = clientErrorMessage(todoError, errorMessages);

  function onChangeFilters(patch: Partial<TodoFilterValues>) {
    const next = { ...filters, ...patch };
    navigate({
      to: "/todo",
      search: toTodoRouteSearch(next),
    });
  }

  function onClearFilters() {
    navigate({ to: "/todo", search: {} });
  }

  function onOpenTodo(id: string) {
    setIsCreateOpen(false);
    navigate({ to: "/todo/$todoId", params: { todoId: id }, search });
  }

  function onOpenCreate(name = "") {
    setCreateName(name);
    setIsCreateOpen(true);
    navigate({ to: "/todo", search });
  }

  async function onCreateTodo(patch: {
    name: string;
    description: string;
    dueDate: string | null;
    status: TodoStatusDTO;
  }) {
    const todo = await createTodo(patch);
    if (!todo) return;
    setIsCreateOpen(false);
  }

  async function onToggleTodoStatus(id: string, status: TodoStatusDTO) {
    await updateTodo(id, {
      status: status === "Completed" ? "Pending" : "Completed",
    });
  }

  useEffect(() => resetFeature, [resetFeature]);

  useEffect(() => {
    void bootstrapTodos(filters);
  }, [search.q, search.dueDate, search.due, search.status]);

  const hasActiveFilters =
    filters.q !== "" ||
    filters.dueDate !== "" ||
    filters.due !== "all" ||
    filters.status !== DEFAULT_TODO_STATUS;

  return (
    <AppShell
      title={t.windowTitle}
      activePath="/todo"
      dictionary={dictionary}
      showLogout
    >
      <TerminalPageHeader
        actions={
          <Button onClick={() => onOpenCreate()} type="button">
            <Plus />
            {t.createPrompt}
          </Button>
        }
        heading={t.heading}
        subtitle={t.subtitle}
      />
      {todoErrorMessage ? (
        <Alert className="mb-4" variant="destructive">
          <AlertCircle />
          <AlertDescription>{todoErrorMessage}</AlertDescription>
          <AlertAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={dictionary.common.dismiss}
                    onClick={clearTodoError}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>{dictionary.common.dismiss}</TooltipContent>
            </Tooltip>
          </AlertAction>
        </Alert>
      ) : null}
      <div className="mb-4">
        <TodoFilters
          filters={filters}
          onChange={onChangeFilters}
          onClear={onClearFilters}
          t={t}
        />
      </div>
      <section aria-labelledby="todo-list-heading" className="space-y-2">
        <h2
          id="todo-list-heading"
          className="m-0 flex items-center gap-2 font-medium text-foreground text-sm"
        >
          {t.listLabel}
          {!isTodoBootstrapping && (
            <span className="font-normal text-muted-foreground">
              {todos.length}
            </span>
          )}
        </h2>
        {isTodoBootstrapping ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="space-y-2"
            role="status"
          >
            <span className="sr-only">{t.loading}</span>
            {loadingRows.map((row) => (
              <Skeleton
                key={row}
                className="h-14 w-full rounded-lg border border-border bg-muted/50"
              />
            ))}
          </div>
        ) : todos.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0">
            {[...todos].sort(compareTodosByUrgency).map((todo) => (
              <li key={todo.id}>
                <TodoRow
                  locale={prefs.locale}
                  onOpen={() => onOpenTodo(todo.id)}
                  onToggleStatus={() =>
                    onToggleTodoStatus(todo.id, todo.status)
                  }
                  t={t}
                  todo={todo}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ListEmptyState
            actions={
              <>
                {hasActiveFilters && (
                  <Button
                    onClick={onClearFilters}
                    type="button"
                    variant="outline"
                  >
                    <X />
                    {t.clearFilters}
                  </Button>
                )}
                <Button onClick={() => onOpenCreate(filters.q)} type="button">
                  <Plus />
                  {filters.q
                    ? t.createNamed.replace("{name}", filters.q)
                    : t.createPrompt}
                </Button>
              </>
            }
            description={hasActiveFilters ? undefined : t.emptyAllDoneHint}
            icon={hasActiveFilters ? SearchX : ListTodo}
            title={hasActiveFilters ? t.emptyState : t.emptyAllDone}
          />
        )}
      </section>
      <TodoDetailDialog
        isSubmitting={isTodoSubmitting}
        initialName={createName}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSave={onCreateTodo}
        open={isCreateOpen}
        t={t}
      />
      <Outlet />
    </AppShell>
  );
}
