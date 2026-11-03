export function toTodoDueDateInputValue(dueDate?: string): string {
  return dueDate?.slice(0, 10) ?? "";
}

export function toTodoDueDateRequestValue(dueDate: string): string | null {
  return dueDate || null;
}
