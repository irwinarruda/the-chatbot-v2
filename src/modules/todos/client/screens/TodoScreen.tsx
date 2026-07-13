import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { ListTodo, MessageSquare, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { TodoComposer } from "~/modules/todos/client/components/TodoComposer";
import {
  TodoFilters,
  type TodoFilterValues,
} from "~/modules/todos/client/components/TodoFilters";
import { TodoRow } from "~/modules/todos/client/components/TodoRow";
import type { TodoErrorCode } from "~/modules/todos/client/state/todoSlice";
import {
  DEFAULT_TODO_STATUS,
  type TodoSearch,
  toTodoRouteSearch,
} from "~/modules/todos/client/TodoSearch";
import type { TodoStatus } from "~/modules/todos/contracts/TodoContracts";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Button } from "~/shared/client/components/ui/button";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

export function TodoScreen({ search }: { search: TodoSearch }) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const todos = useApp((s) => s.todos);
  const todoDraft = useApp((s) => s.todoDraft);
  const todoError = useApp((s) => s.todoError);
  const isTodoBootstrapping = useApp((s) => s.isTodoBootstrapping);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
  const pendingTodoCount = useApp((s) => s.pendingTodoCount);
  const completedTodoCount = useApp((s) => s.completedTodoCount);
  const canSaveTodoDraft = useApp((s) => s.canSaveTodoDraft);
  const bootstrapTodos = useApp((s) => s.bootstrapTodos);
  const setTodoDraft = useApp((s) => s.setTodoDraft);
  const resetTodoDraft = useApp((s) => s.resetTodoDraft);
  const createTodoFromDraft = useApp((s) => s.createTodoFromDraft);
  const updateTodo = useApp((s) => s.updateTodo);
  const clearTodoError = useApp((s) => s.clearTodoError);
  const [isTodoComposerOpen, setIsTodoComposerOpen] = useState(false);
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
  const todoErrorMessage = todoError ? errorMessages[todoError] : undefined;
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
    navigate({ to: "/todo/$todoId", params: { todoId: id }, search });
  }

  function onCancelTodo() {
    resetTodoDraft();
    setIsTodoComposerOpen(false);
  }

  async function onCreateTodo() {
    const todo = await createTodoFromDraft();
    if (!todo) return;
    setIsTodoComposerOpen(false);
  }

  async function onToggleTodoStatus(id: string, status: TodoStatus) {
    await updateTodo(id, {
      status: status === "Completed" ? "Pending" : "Completed",
    });
  }

  useEffect(() => {
    void bootstrapTodos(filters);
  }, [search.q, search.dueDate, search.due, search.status]);

  return (
    <TerminalWindow
      title={t.windowTitle}
      wide
      activePath="/todo"
      dictionary={dictionary}
      mainClassName="items-stretch sm:items-start"
      frameClassName="min-h-dvh sm:min-h-[calc(100dvh-3rem)] md:min-h-[calc(100dvh-5rem)]"
      windowClassName="relative overflow-hidden"
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
        badge={
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-2xs">
            <span className="border border-term-amber/40 px-2 py-1 text-term-amber">
              {pendingTodoCount} {t.statusPending}
            </span>
            <span className="border border-term-green/40 px-2 py-1 text-term-green">
              {completedTodoCount} {t.statusCompleted}
            </span>
            <Link
              className="inline-flex items-center gap-1 border border-term-blue/40 px-2 py-1 text-term-blue hover:border-term-cyan hover:text-term-cyan"
              to="/chat"
            >
              <MessageSquare className="size-3.5" />
              {t.chatAction}
            </Link>
          </div>
        }
      />
      {todoErrorMessage && (
        <Alert className="mb-4 border-term-red/30 bg-term-red/10">
          <AlertDescription className="flex items-center justify-between gap-3 text-term-red">
            <span>{todoErrorMessage}</span>
            <Button onClick={clearTodoError} size="icon-xs" variant="ghost">
              x
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <section className="mb-4 border border-term-border bg-term-chrome/50 p-3">
        <TodoFilters
          action={
            !isTodoComposerOpen && (
              <Button
                className="w-full md:w-auto"
                onClick={() => setIsTodoComposerOpen(true)}
                type="button"
              >
                <Plus />
                {t.createPrompt}
              </Button>
            )
          }
          filters={filters}
          onChange={onChangeFilters}
          onClear={onClearFilters}
          t={t}
        />
      </section>
      {isTodoComposerOpen && (
        <section className="mb-4">
          <TodoComposer
            canSave={canSaveTodoDraft}
            draft={todoDraft}
            isSubmitting={isTodoSubmitting}
            onChange={setTodoDraft}
            onCancel={onCancelTodo}
            onSubmit={onCreateTodo}
            t={t}
          />
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-2xs text-term-muted uppercase">
          <ListTodo className="size-3.5 text-term-green" />
          {t.listLabel}
        </div>
        {isTodoBootstrapping ? (
          <div className="border border-term-border bg-term-bg/40 p-6 text-center text-sm text-term-muted">
            <span className="terminal-cursor" />
            {t.loading}
          </div>
        ) : todos.length > 0 ? (
          todos.map((todo) => (
            <TodoRow
              key={todo.id}
              noDueDateLabel={t.noDueDate}
              onClick={() => onOpenTodo(todo.id)}
              onToggleStatus={() => onToggleTodoStatus(todo.id, todo.status)}
              todo={todo}
            />
          ))
        ) : (
          <div className="border border-term-border border-dashed bg-term-bg/40 p-8 text-center text-sm text-term-muted">
            {t.emptyState}
          </div>
        )}
      </section>
      <Outlet />
    </TerminalWindow>
  );
}
