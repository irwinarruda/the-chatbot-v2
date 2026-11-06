import type {
  TodoDueFilterDTO,
  TodoStatusDTO,
} from "~/contracts/http/todos/todo";

export type TodoSearch = {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilterDTO;
  status?: "all" | TodoStatusDTO;
};

export const DEFAULT_TODO_STATUS: TodoStatusDTO = "Pending";

export function normalizeTodoSearch(
  search: Record<string, unknown>,
): TodoSearch {
  const due = search.due;
  const status = search.status;
  const dueDate =
    typeof search.dueDate === "string" ? search.dueDate : undefined;
  let dueFilter: TodoSearch["due"] = "all";
  if (due === "with_due_date" || due === "without_due_date") dueFilter = due;
  if (dueDate) dueFilter = "with_due_date";
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    dueDate,
    due: dueFilter,
    status:
      status === "Pending" || status === "Completed" || status === "all"
        ? status
        : DEFAULT_TODO_STATUS,
  };
}

export function toTodoRouteSearch(search: TodoSearch): TodoSearch {
  return {
    q: search.q || undefined,
    dueDate: search.dueDate || undefined,
    due: search.due === "all" ? undefined : search.due,
    status: search.status === DEFAULT_TODO_STATUS ? undefined : search.status,
  };
}
