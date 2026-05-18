import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { ListTodo, MessageSquare, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { TodoComposer } from "~/client/components/TodoComposer";
import {
  TodoFilters,
  type TodoFilterValues,
} from "~/client/components/TodoFilters";
import { TodoRow } from "~/client/components/TodoRow";
import { Alert, AlertDescription } from "~/client/components/ui/alert";
import { Button } from "~/client/components/ui/button";
import type { TodoDueFilter, TodoStatus } from "~/client/entities/Todo";
import { getDictionary } from "~/client/i18n";
import { usePrefs } from "~/client/providers/usePrefs";
import { useApp } from "~/client/stores";
import type { TodoErrorCode } from "~/client/stores/slices/todoSlice";
import { requireWebAccess } from "~/server/tanstack/functions/require-web-access";

export type TodoSearch = {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilter;
  status?: "all" | TodoStatus;
};

export function normalizeTodoSearch(
  search: Record<string, unknown>,
): TodoSearch {
  const due = search.due;
  const status = search.status;
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    dueDate: typeof search.dueDate === "string" ? search.dueDate : undefined,
    due:
      due === "with_due_date" || due === "without_due_date" || due === "all"
        ? due
        : "all",
    status:
      status === "Pending" || status === "Completed" || status === "all"
        ? status
        : "all",
  };
}

function toTodoRouteSearch(filters: TodoFilterValues): TodoSearch {
  return {
    q: filters.q || undefined,
    dueDate: filters.dueDate || undefined,
    due: filters.due === "all" ? undefined : filters.due,
    status: filters.status === "all" ? undefined : filters.status,
  };
}

export const Route = createFileRoute("/todo")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({ to: "/chat/login" });
    }
  },
  validateSearch: normalizeTodoSearch,
  component: TodoLayout,
  head: () => ({
    meta: [{ title: "Todos - The Chatbot" }],
  }),
});

function TodoLayout() {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const search = Route.useSearch();
  const todos = useApp((s) => s.todos);
  const todoDraft = useApp((s) => s.todoDraft);
  const todoError = useApp((s) => s.todoError);
  const isTodoBootstrapping = useApp((s) => s.isTodoBootstrapping);
  const isTodoSubmitting = useApp((s) => s.isTodoSubmitting);
  const pendingTodoCount = useApp((s) => s.pendingTodoCount);
  const completedTodoCount = useApp((s) => s.completedTodoCount);
  const canSaveTodoDraft = useApp((s) => s.canSaveTodoDraft);
  const bootstrapTodos = useApp((s) => s.bootstrapTodos);
  const setTodoFilters = useApp((s) => s.setTodoFilters);
  const setTodoDraft = useApp((s) => s.setTodoDraft);
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
    status: search.status ?? "all",
  };
  const errorMessages: Record<TodoErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    deleting: t.errorDeleting,
  };
  const todoErrorMessage = todoError ? errorMessages[todoError] : undefined;
  const onChangeFilters = (patch: Partial<TodoFilterValues>) => {
    const next = { ...filters, ...patch };
    setTodoFilters(next);
    navigate({
      to: "/todo",
      search: toTodoRouteSearch(next),
    });
  };
  const onClearFilters = () => {
    const next: TodoFilterValues = {
      q: "",
      dueDate: "",
      due: "all",
      status: "all",
    };
    setTodoFilters(next);
    navigate({ to: "/todo", search: {} });
  };
  const onOpenTodo = (id: string) => {
    navigate({ to: "/todo/$todoId", params: { todoId: id }, search });
  };
  const onCreateTodo = async () => {
    const todo = await createTodoFromDraft();
    if (!todo) return;
    setIsTodoComposerOpen(false);
    await bootstrapTodos(filters);
  };
  const onToggleTodoStatus = async (id: string, status: TodoStatus) => {
    await updateTodo(id, {
      status: status === "Completed" ? "Pending" : "Completed",
    });
    await bootstrapTodos(filters);
  };
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
      {todoErrorMessage ? (
        <Alert className="mb-4 border-term-red/30 bg-term-red/10">
          <AlertDescription className="flex items-center justify-between gap-3 text-term-red">
            <span>{todoErrorMessage}</span>
            <Button onClick={clearTodoError} size="icon-xs" variant="ghost">
              x
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="mb-4 border border-term-border bg-term-chrome/50 p-3">
        <TodoFilters
          filters={filters}
          onChange={onChangeFilters}
          onClear={onClearFilters}
          t={t}
        />
      </section>
      {isTodoComposerOpen ? (
        <section className="mb-4">
          <TodoComposer
            canSave={canSaveTodoDraft}
            draft={todoDraft}
            isSubmitting={isTodoSubmitting}
            onChange={setTodoDraft}
            onSubmit={onCreateTodo}
            t={t}
          />
        </section>
      ) : (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setIsTodoComposerOpen(true)} type="button">
            <Plus />
            {t.createPrompt}
          </Button>
        </div>
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
