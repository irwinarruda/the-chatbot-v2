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
import type { TodoErrorCode } from "~/client/modules/todos/app/services/TodoService";
import { TodoDetailDialog } from "~/client/modules/todos/components/TodoDetailDialog";
import {
  DEFAULT_TODO_STATUS,
  type TodoSearch,
  toTodoRouteSearch,
} from "~/client/modules/todos/parsers/TodoSearch";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/client/shared/components/ui/empty";
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
  const pendingTodoCount = useApp((s) => s.pendingTodoCount);
  const completedTodoCount = useApp((s) => s.completedTodoCount);
  const bootstrapTodos = useApp((s) => s.bootstrapTodos);
  const createTodo = useApp((s) => s.createTodo);
  const updateTodo = useApp((s) => s.updateTodo);
  const clearTodoError = useApp((s) => s.clearTodoError);
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

  function onOpenCreate() {
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

  return (
    <TerminalWindow
      title={t.windowTitle}
      wide
      activePath="/todo"
      dictionary={dictionary}
      showLogout
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
              className="gap-1.5 border-warning/40 bg-warning/10 text-warning"
              variant="outline"
            >
              <Circle />
              {pendingTodoCount} {t.statusPending}
            </Badge>
            <Badge
              className="gap-1.5 border-success/40 bg-success/10 text-success"
              variant="outline"
            >
              <CheckCircle2 />
              {completedTodoCount} {t.statusCompleted}
            </Badge>
            <Badge
              className="gap-1.5 border-info/40 bg-info/10 text-info hover:border-info hover:bg-info/15 hover:text-info"
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
      <Card
        className="mb-4 gap-0 border-border bg-muted/45 py-0 shadow-none"
        size="sm"
      >
        <CardContent className="p-3">
          <TodoFilters
            action={
              <Button
                className="w-full md:w-auto"
                onClick={onOpenCreate}
                type="button"
              >
                <Plus />
                {t.createPrompt}
              </Button>
            }
            filters={filters}
            onChange={onChangeFilters}
            onClear={onClearFilters}
            t={t}
          />
        </CardContent>
      </Card>
      <section aria-labelledby="todo-list-heading" className="space-y-2">
        <div
          id="todo-list-heading"
          className="flex items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-wide"
        >
          <ListTodo className="size-3.5 text-primary" />
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
                className="h-14 w-full rounded-lg border border-border bg-muted/50"
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
          <Empty className="rounded-lg border border-border bg-background/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTodo className="text-primary" />
              </EmptyMedia>
              <EmptyTitle className="text-muted-foreground">
                {t.emptyState}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <TodoDetailDialog
        isSubmitting={isTodoSubmitting}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSave={onCreateTodo}
        open={isCreateOpen}
        t={t}
        theme={prefs.theme}
      />
      <Outlet />
    </TerminalWindow>
  );
}
