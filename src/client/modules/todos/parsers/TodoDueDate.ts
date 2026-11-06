export function toTodoDueDateInputValue(dueDate?: string): string {
  return dueDate?.slice(0, 10) ?? "";
}

export function toTodoDueDateRequestValue(dueDate: string): string | null {
  return dueDate || null;
}

export const TodoDueUrgency = {
  Overdue: "overdue",
  Today: "today",
  Upcoming: "upcoming",
} as const;

export type TodoDueUrgency = ValueOf<typeof TodoDueUrgency>;

export function getTodoDueUrgency(dueDate: string, now: Date): TodoDueUrgency {
  const due = dueDate.slice(0, 10);
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  if (due < today) return TodoDueUrgency.Overdue;
  if (due === today) return TodoDueUrgency.Today;
  return TodoDueUrgency.Upcoming;
}

export function compareTodosByUrgency(
  first: { dueDate?: string; status: string },
  second: { dueDate?: string; status: string },
): number {
  if (first.status !== second.status)
    return first.status === "Pending" ? -1 : 1;
  if (first.dueDate && second.dueDate)
    return first.dueDate.localeCompare(second.dueDate);
  if (first.dueDate) return -1;
  if (second.dueDate) return 1;
  return 0;
}
