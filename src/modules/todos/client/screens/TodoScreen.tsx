import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ListTodo,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
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
import type { TodoStatusDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/shared/client/components/ui/alert";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/shared/client/components/ui/empty";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

const loadingRows = ["first", "second", "third"];

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

  async function onToggleTodoStatus(id: string, status: TodoStatusDTO) {
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
      frameClassName="page-frame-min-height"
      windowClassName="relative overflow-hidden"
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
        badge={
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge
              className="gap-1.5 border-term-amber/40 bg-term-amber/5 text-term-amber"
              variant="outline"
            >
              <Circle />
              {pendingTodoCount} {t.statusPending}
            </Badge>
            <Badge
              className="gap-1.5 border-term-green/40 bg-term-green/5 text-term-green"
              variant="outline"
            >
              <CheckCircle2 />
              {completedTodoCount} {t.statusCompleted}
            </Badge>
            <Badge
              className="gap-1.5 border-term-blue/40 bg-term-blue/5 text-term-blue hover:border-term-cyan hover:bg-term-cyan/10 hover:text-term-cyan"
              render={<Link to="/chat" />}
              variant="outline"
            >
              <MessageSquare />
              {t.chatAction}
            </Badge>
          </div>
        }
      />
      {todoErrorMessage ? (
        <Alert
          className="mb-4 border-term-red/30 bg-term-red/10"
          variant="destructive"
        >
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
      <Card
        className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
        size="sm"
      >
        <CardContent className="p-3">
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
        </CardContent>
      </Card>
      {isTodoComposerOpen && (
        <section aria-label={t.createPrompt} className="mb-4">
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
      <section aria-labelledby="todo-list-heading" className="space-y-2">
        <div
          id="todo-list-heading"
          className="flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide"
        >
          <ListTodo className="size-3.5 text-term-green" />
          {t.listLabel}
        </div>
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
                className="h-14 w-full rounded-lg border border-term-border bg-term-chrome/50"
              />
            ))}
          </div>
        ) : todos.length > 0 ? (
          <ul className="m-0 list-none space-y-2 p-0">
            {todos.map((todo) => (
              <li key={todo.id}>
                <TodoRow
                  completedLabel={t.statusCompleted}
                  locale={prefs.locale}
                  noDueDateLabel={t.noDueDate}
                  onOpen={() => onOpenTodo(todo.id)}
                  onToggleStatus={() =>
                    onToggleTodoStatus(todo.id, todo.status)
                  }
                  pendingLabel={t.statusPending}
                  todo={todo}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="rounded-lg border border-term-border bg-term-bg/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTodo className="text-term-green" />
              </EmptyMedia>
              <EmptyTitle className="text-term-muted">
                {t.emptyState}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <Outlet />
    </TerminalWindow>
  );
}
