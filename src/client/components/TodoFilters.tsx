import { Calendar, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TodoDueFilter, TodoStatus } from "~/client/entities/Todo";
import type { Dictionary } from "~/client/i18n";
import { useDebouncedValue } from "~/client/utils/useDebouncedValue";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

export type TodoFilterValues = {
  q: string;
  dueDate: string;
  due: TodoDueFilter;
  status: "all" | TodoStatus;
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
      status: "all",
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
    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
        <Input
          aria-label={t.searchPlaceholder}
          className="pl-8"
          onChange={(event) => onChangeDraftFilters({ q: event.target.value })}
          placeholder={t.searchPlaceholder}
          value={draftFilters.q}
        />
      </div>
      <NativeSelect
        className="w-full md:w-40"
        onChange={(event) =>
          onChangeDraftFilters({
            status: event.target.value as "all" | TodoStatus,
          })
        }
        value={draftFilters.status}
      >
        <NativeSelectOption value="all">{t.statusAll}</NativeSelectOption>
        <NativeSelectOption value="Pending">
          {t.statusPending}
        </NativeSelectOption>
        <NativeSelectOption value="Completed">
          {t.statusCompleted}
        </NativeSelectOption>
      </NativeSelect>
      <div className="relative min-w-0">
        <Calendar className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
        <Input
          aria-label={t.dueAll}
          className="pl-8 md:w-40"
          onChange={(event) =>
            onChangeDraftFilters({ dueDate: event.target.value })
          }
          type="date"
          value={draftFilters.dueDate}
        />
      </div>
      <NativeSelect
        className="w-full md:w-44"
        onChange={(event) =>
          onChangeDraftFilters({ due: event.target.value as TodoDueFilter })
        }
        value={draftFilters.due}
      >
        <NativeSelectOption value="all">{t.dueAll}</NativeSelectOption>
        <NativeSelectOption value="with_due_date">
          {t.dueWithDueDate}
        </NativeSelectOption>
        <NativeSelectOption value="without_due_date">
          {t.dueWithoutDueDate}
        </NativeSelectOption>
      </NativeSelect>
      <Button onClick={onClearFilters} type="button" variant="outline">
        <X />
        {t.clearFilters}
      </Button>
    </div>
  );
}
