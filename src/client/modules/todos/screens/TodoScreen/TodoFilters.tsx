import { Calendar, CheckCircle2, Circle, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_TODO_STATUS } from "~/client/modules/todos/parsers/TodoSearch";
import { Button } from "~/client/shared/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "~/client/shared/components/ui/field";
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
  return t.statusAll;
}

function getDueLabel(due: TodoFilterValues["due"], t: Dictionary["todoPage"]) {
  if (due === "with_due_date") return t.dueWithDueDate;
  if (due === "without_due_date") return t.dueWithoutDueDate;
  return t.dueAll;
}

export function TodoFilters({
  action,
  filters,
  onClear,
  onChange,
  t,
}: {
  action?: ReactNode;
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

  return (
    <FieldGroup className="gap-3">
      <div
        className={
          action
            ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            : "grid"
        }
      >
        <Field>
          <FieldLabel htmlFor="todo-filter-search">
            <Search className="size-3.5 text-muted-foreground" />
            {t.searchPlaceholder}
          </FieldLabel>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="todo-filter-search"
              className="pl-8"
              onChange={(event) =>
                onChangeDraftFilters({ q: event.target.value })
              }
              placeholder={t.searchPlaceholder}
              type="search"
              value={draftFilters.q}
            />
          </div>
        </Field>
        {action}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[minmax(9rem,0.8fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor="todo-filter-status">
            <Circle className="size-3.5 text-muted-foreground" />
            {t.statusAll}
          </FieldLabel>
          <Select
            onValueChange={(value) => {
              if (!value) return;
              onChangeDraftFilters({
                status: value as TodoFilterValues["status"],
              });
            }}
            value={draftFilters.status}
          >
            <SelectTrigger id="todo-filter-status" className="w-full">
              <SelectValue>
                {getStatusLabel(draftFilters.status, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">{t.statusAll}</SelectItem>
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
        </Field>
        <Field>
          <FieldLabel htmlFor="todo-filter-due-date">
            <Calendar className="size-3.5 text-muted-foreground" />
            {t.dueWithDueDate}
          </FieldLabel>
          <Input
            id="todo-filter-due-date"
            onChange={(event) =>
              onChangeDraftFilters({ dueDate: event.target.value })
            }
            type="date"
            value={draftFilters.dueDate}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="todo-filter-due">
            <Calendar className="size-3.5 text-muted-foreground" />
            {t.dueAll}
          </FieldLabel>
          <Select
            onValueChange={(value) => {
              if (!value) return;
              onChangeDraftFilters({ due: value as TodoDueFilterDTO });
            }}
            value={draftFilters.due}
          >
            <SelectTrigger id="todo-filter-due" className="w-full">
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
        </Field>
        <Button
          className="w-full sm:col-span-2 md:col-span-1 md:w-auto"
          onClick={onClearFilters}
          type="button"
          variant="outline"
        >
          <X />
          {t.clearFilters}
        </Button>
      </div>
    </FieldGroup>
  );
}
