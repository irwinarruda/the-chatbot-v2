import { Calendar, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_TODO_STATUS } from "~/modules/todos/client/TodoSearch";
import { useDebouncedValue } from "~/modules/todos/client/utils/useDebouncedValue";
import type {
  TodoDueFilterDTO,
  TodoStatusDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";
import { Button } from "~/shared/client/components/ui/button";
import { Input } from "~/shared/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/shared/client/components/ui/native-select";
import type { Dictionary } from "~/shared/client/i18n";

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
    <div className="grid gap-2">
      <div
        className={
          action ? "grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" : "grid"
        }
      >
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
          <Input
            aria-label={t.searchPlaceholder}
            className="pl-8"
            onChange={(event) =>
              onChangeDraftFilters({ q: event.target.value })
            }
            placeholder={t.searchPlaceholder}
            value={draftFilters.q}
          />
        </div>
        {action}
      </div>
      <div className="grid gap-2 md:grid-cols-[auto_auto_minmax(10rem,1fr)_auto]">
        <NativeSelect
          className="w-full md:w-40"
          onChange={(event) =>
            onChangeDraftFilters({
              status: event.target.value as "all" | TodoStatusDTO,
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
          className="w-full"
          onChange={(event) =>
            onChangeDraftFilters({
              due: event.target.value as TodoDueFilterDTO,
            })
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
    </div>
  );
}
