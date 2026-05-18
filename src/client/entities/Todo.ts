import type { ChatMessage } from "~/client/entities/ChatMessage";

export type TodoStatus = "Pending" | "Completed";
export type TodoDueFilter = "all" | "with_due_date" | "without_due_date";

export interface Todo {
  id: string;
  sourceMessage?: ChatMessage;
  name: string;
  description: string;
  dueDate?: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}
