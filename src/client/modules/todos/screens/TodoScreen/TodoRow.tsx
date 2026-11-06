import { Calendar } from "lucide-react";
import {
  getTodoDueUrgency,
  TodoDueUrgency,
} from "~/client/modules/todos/parsers/TodoDueDate";
import { Checkbox } from "~/client/shared/components/ui/checkbox";
import { cn } from "~/client/shared/components/ui/lib/utils";
import type { Dictionary, Locale } from "~/client/shared/i18n/dictionary";
import type { TodoDTO } from "~/contracts/http/todos/todo";

const dueClassNames = {
  [TodoDueUrgency.Overdue]: "text-destructive",
  [TodoDueUrgency.Today]: "text-warning",
  [TodoDueUrgency.Upcoming]: "text-muted-foreground",
};

export function TodoRow({
  locale,
  onOpen,
  onToggleStatus,
  t,
  todo,
}: {
  locale: Locale;
  onOpen: () => void;
  onToggleStatus: () => void;
  t: Dictionary["todoPage"];
  todo: TodoDTO;
}) {
  const isCompleted = todo.status === "Completed";
  const statusLabel = isCompleted ? t.statusCompleted : t.statusPending;
  const dateLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
  const dueDate =
    todo.dueDate &&
    new Intl.DateTimeFormat(dateLocale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(todo.dueDate));
  const urgency =
    todo.dueDate && !isCompleted
      ? getTodoDueUrgency(todo.dueDate, new Date())
      : TodoDueUrgency.Upcoming;
  const dueLabels = {
    [TodoDueUrgency.Overdue]: `${t.dueOverdue} · ${dueDate}`,
    [TodoDueUrgency.Today]: t.dueToday,
    [TodoDueUrgency.Upcoming]: `${t.duePrefix} ${dueDate}`,
  };

  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
      <Checkbox
        aria-label={`${todo.name}: ${statusLabel}`}
        checked={isCompleted}
        className="relative z-10 size-5 after:-inset-3"
        onCheckedChange={onToggleStatus}
      />
      <button
        className="min-w-0 text-left outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        onClick={onOpen}
        type="button"
      >
        <span
          className={cn(
            "block truncate font-medium text-sm",
            isCompleted
              ? "text-muted-foreground line-through"
              : "text-foreground",
          )}
        >
          {todo.name}
        </span>
        {(todo.dueDate || todo.description) && (
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {todo.dueDate && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1",
                  dueClassNames[urgency],
                )}
              >
                <Calendar className="size-3" aria-hidden="true" />
                <time dateTime={todo.dueDate}>{dueLabels[urgency]}</time>
              </span>
            )}
            {todo.description && (
              <span className="line-clamp-2 min-w-0 text-muted-foreground sm:line-clamp-1">
                {todo.description}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}
