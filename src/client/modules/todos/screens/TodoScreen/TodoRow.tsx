import { Calendar, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import { Checkbox } from "~/client/shared/components/ui/checkbox";
import { cn } from "~/client/shared/components/ui/lib/utils";
import type { Locale } from "~/client/shared/i18n/dictionary";
import type { TodoDTO } from "~/contracts/http/todos/todo";

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
        "relative gap-0 border-border border-l-2 bg-background/45 py-0 shadow-none",
        "transition-colors hover:border-l-brand hover:bg-muted/65",
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
              className="shrink-0 font-bold font-mono text-primary text-xs"
            >
              &gt;_
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium text-sm",
                isCompleted
                  ? "text-muted-foreground line-through"
                  : "text-foreground",
              )}
            >
              {todo.name}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                todo.dueDate ? "text-syntax-constant" : "text-muted-foreground",
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
              ? "border-success/35 bg-success/10 text-success"
              : "border-warning/35 bg-warning/10 text-warning",
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
