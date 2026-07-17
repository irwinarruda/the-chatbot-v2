import { Calendar, CheckCircle2, Circle } from "lucide-react";
import type { TodoDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import { Checkbox } from "~/shared/client/components/ui/checkbox";
import { cn } from "~/shared/client/components/ui/lib";
import type { Locale } from "~/shared/client/i18n";

export function TodoRow({
  completedLabel,
  locale,
  noDueDateLabel,
  onOpen,
  onToggleStatus,
  pendingLabel,
  todo,
}: {
  completedLabel: string;
  locale: Locale;
  noDueDateLabel: string;
  onOpen: () => void;
  onToggleStatus: () => void;
  pendingLabel: string;
  todo: TodoDTO;
}) {
  const isCompleted = todo.status === "Completed";
  const statusLabel = isCompleted ? completedLabel : pendingLabel;
  const dateLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
  const dueDate = todo.dueDate
    ? new Intl.DateTimeFormat(dateLocale, {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(todo.dueDate))
    : noDueDateLabel;

  return (
    <Card
      className={cn(
        "relative gap-0 border-term-border border-l-2 bg-term-bg/45 py-0 shadow-none",
        "transition-colors hover:border-l-term-green hover:bg-term-chrome/65",
      )}
      size="sm"
    >
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2">
        <Button
          aria-label={todo.name}
          className="absolute inset-0 h-auto rounded-lg hover:bg-transparent"
          onClick={onOpen}
          type="button"
          variant="ghost"
        />
        <Checkbox
          aria-label={`${todo.name}: ${statusLabel}`}
          checked={isCompleted}
          className="pointer-events-auto relative z-10 size-4 after:-inset-3"
          onCheckedChange={onToggleStatus}
        />
        <div className="pointer-events-none relative min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="shrink-0 font-bold font-mono text-term-green text-xs"
            >
              &gt;_
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium text-sm",
                isCompleted
                  ? "text-term-muted line-through"
                  : "text-term-bright",
              )}
            >
              {todo.name}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs text-term-muted">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                todo.dueDate ? "text-term-amber" : "text-term-muted",
              )}
            >
              <Calendar className="size-3" />
              {todo.dueDate ? (
                <time dateTime={todo.dueDate}>{dueDate}</time>
              ) : (
                dueDate
              )}
            </span>
            <time className="truncate" dateTime={todo.createdAt}>
              {new Date(todo.createdAt).toLocaleString(dateLocale)}
            </time>
          </div>
        </div>
        <Badge
          className={cn(
            "pointer-events-none relative z-10 shrink-0 gap-1",
            isCompleted
              ? "border-term-green/35 bg-term-green/5 text-term-green"
              : "border-term-amber/35 bg-term-amber/5 text-term-amber",
          )}
          variant="outline"
        >
          {isCompleted ? <CheckCircle2 /> : <Circle />}
          {statusLabel}
        </Badge>
      </CardContent>
    </Card>
  );
}
