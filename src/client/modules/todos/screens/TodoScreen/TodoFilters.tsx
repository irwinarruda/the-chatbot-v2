import { CheckCircle2, Circle, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_TODO_STATUS } from "~/client/modules/todos/parsers/TodoSearch";
import { Button } from "~/client/shared/components/ui/button";
import { Input } from "~/client/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/client/shared/components/ui/select";
import { useDebouncedValue } from "~/client/shared/hooks/useDebouncedValue";
import type { Dictionary } from "~/client/shared/i18n/dictionary";
import type {
  TodoDueFilterDTO,
  TodoStatusDTO,
} from "~/contracts/http/todos/todo";

export type TodoFilterValues = {
  q: string;
  dueDate: string;
  due: TodoDueFilterDTO;
  status: "all" | TodoStatusDTO;
};

function areTodoFiltersEqual(
  first: TodoFilterValues,
  second: TodoFilterValues,
) {
  return (
    first.q === second.q &&
    first.dueDate === second.dueDate &&
    first.due === second.due &&
    first.status === second.status
  );
}

function getStatusLabel(
  status: TodoFilterValues["status"],
  t: Dictionary["todoPage"],
) {
  if (status === "Pending") return t.statusPending;
  if (status === "Completed") return t.statusCompleted;
  return t.statusAllShort;
}

function getDueLabel(due: TodoFilterValues["due"], t: Dictionary["todoPage"]) {
  if (due === "with_due_date") return t.dueWithDueDate;
  if (due === "without_due_date") return t.dueWithoutDueDate;
  return t.dueAll;
}

export function TodoFilters({
  filters,
  onClear,
  onChange,
  t,
}: {
  filters: TodoFilterValues;
  onClear: () => void;
  onChange: (filters: Partial<TodoFilterValues>) => void;
  t: Dictionary["todoPage"];
}) {
  const [draftFilters, setDraftFilters] = useState<TodoFilterValues>(filters);
  const debouncedFilters = useDebouncedValue(draftFilters, 350);
  const onChangeDraftFilters = (patch: Partial<TodoFilterValues>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };
  const onClearFilters = () => {
    setDraftFilters({
      q: "",
      dueDate: "",
      due: "all",
      status: DEFAULT_TODO_STATUS,
    });
    onClear();
  };

  useEffect(() => {
    setDraftFilters((current) =>
      areTodoFiltersEqual(current, filters) ? current : filters,
    );
  }, [filters.q, filters.dueDate, filters.due, filters.status]);
  useEffect(() => {
    if (areTodoFiltersEqual(debouncedFilters, filters)) return;
    onChange(debouncedFilters);
  }, [
    debouncedFilters.q,
    debouncedFilters.dueDate,
    debouncedFilters.due,
    debouncedFilters.status,
  ]);

  const hasActiveFilters =
    draftFilters.q !== "" ||
    draftFilters.dueDate !== "" ||
    draftFilters.due !== "all" ||
    draftFilters.status !== DEFAULT_TODO_STATUS;

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t.searchPlaceholder}
          id="todo-filter-search"
          className="pl-8"
          onChange={(event) => onChangeDraftFilters({ q: event.target.value })}
          placeholder={t.searchPlaceholder}
          type="search"
          value={draftFilters.q}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Select
          onValueChange={(value) => {
            if (!value) return;
            onChangeDraftFilters({
              status: value as TodoFilterValues["status"],
            });
          }}
          value={draftFilters.status}
        >
          <SelectTrigger
            aria-label={t.statusFilterLabel}
            id="todo-filter-status"
            className="w-full sm:w-36"
          >
            <SelectValue>{getStatusLabel(draftFilters.status, t)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">{t.statusAllShort}</SelectItem>
            <SelectItem value="Pending">
              <Circle className="text-warning" />
              {t.statusPending}
            </SelectItem>
            <SelectItem value="Completed">
              <CheckCircle2 className="text-success" />
              {t.statusCompleted}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => {
            if (!value) return;
            onChangeDraftFilters({ due: value as TodoDueFilterDTO });
          }}
          value={draftFilters.due}
        >
          <SelectTrigger
            aria-label={t.dueFilterLabel}
            id="todo-filter-due"
            className="w-full sm:w-40"
          >
            <SelectValue>{getDueLabel(draftFilters.due, t)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">{t.dueAll}</SelectItem>
            <SelectItem value="with_due_date">{t.dueWithDueDate}</SelectItem>
            <SelectItem value="without_due_date">
              {t.dueWithoutDueDate}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label={t.dueDateFilterLabel}
          className="w-full sm:w-40"
          id="todo-filter-due-date"
          onChange={(event) =>
            onChangeDraftFilters({ dueDate: event.target.value })
          }
          title={t.dueDateFilterLabel}
          type="date"
          value={draftFilters.dueDate}
        />
        {hasActiveFilters && (
          <Button onClick={onClearFilters} type="button" variant="ghost">
            <X />
            {t.clearFilters}
          </Button>
        )}
      </div>
    </div>
  );
}
