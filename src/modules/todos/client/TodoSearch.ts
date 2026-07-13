import type {
  TodoDueFilter,
  TodoStatus,
} from "~/modules/todos/contracts/TodoContracts";

export type TodoSearch = {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilter;
  status?: "all" | TodoStatus;
};

export function normalizeTodoSearch(
  search: Record<string, unknown>,
): TodoSearch {
  const due = search.due;
  const status = search.status;
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    dueDate: typeof search.dueDate === "string" ? search.dueDate : undefined,
    due:
      due === "with_due_date" || due === "without_due_date" || due === "all"
        ? due
        : "all",
    status:
      status === "Pending" || status === "Completed" || status === "all"
        ? status
        : "all",
  };
}

export function toTodoRouteSearch(search: TodoSearch): TodoSearch {
  return {
    q: search.q || undefined,
    dueDate: search.dueDate || undefined,
    due: search.due === "all" ? undefined : search.due,
    status: search.status === "all" ? undefined : search.status,
  };
}
