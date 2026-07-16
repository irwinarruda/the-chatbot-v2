import { Calendar, CheckCircle2, Circle } from "lucide-react";
import type { TodoDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { cn } from "~/shared/client/components/ui/lib";

export function TodoRow({
  noDueDateLabel,
  onClick,
  onToggleStatus,
  todo,
}: {
  noDueDateLabel: string;
  onClick: () => void;
  onToggleStatus: () => void;
  todo: TodoDTO;
}) {
  const isCompleted = todo.status === "Completed";
  const dueDate = todo.dueDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(new Date(todo.dueDate))
    : noDueDateLabel;
  return (
    <div
      className={cn(
        "relative grid w-full grid-cols-[auto_1fr] gap-3 border-term-border border-l-2",
        "bg-term-bg/45 px-3 py-3 text-left transition-colors hover:border-term-green",
        "hover:bg-term-chrome/80",
      )}
    >
      <button
        aria-label={todo.name}
        className="absolute inset-0 cursor-pointer"
        onClick={onClick}
        type="button"
      />
      <span className="pt-0.5 font-bold text-term-green text-xs">&gt;_</span>
      <span className="pointer-events-none relative min-w-0 space-y-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "min-w-0 flex-1 font-medium text-sm",
              isCompleted ? "text-term-muted line-through" : "text-term-bright",
            )}
          >
            {todo.name}
          </span>
          <button
            className={cn(
              "pointer-events-auto relative inline-flex cursor-pointer items-center gap-1",
              "min-h-10 pointer-fine:min-h-0 border border-transparent pointer-fine:px-1 px-2 pointer-fine:py-0.5 py-1 text-2xs uppercase",
              "transition-colors hover:border-current",
              isCompleted ? "text-term-green" : "text-term-amber",
            )}
            onClick={onToggleStatus}
            type="button"
          >
            {isCompleted ? <CheckCircle2 /> : <Circle />}
            {todo.status}
          </button>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-term-muted">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              todo.dueDate ? "text-term-amber" : "text-term-muted",
            )}
          >
            <Calendar className="size-3" />
            {dueDate}
          </span>
          <span>{new Date(todo.createdAt).toLocaleString()}</span>
        </span>
      </span>
    </div>
  );
}
