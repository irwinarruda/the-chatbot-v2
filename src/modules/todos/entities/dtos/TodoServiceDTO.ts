import type { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";

export interface TodoFiltersDTO {
  search?: string;
  dueDate?: Date;
  due?: "all" | "with_due_date" | "without_due_date";
  status?: TodoStatus;
}

export interface CreateTodoDTO {
  idUser: string;
  idSourceMessage?: string;
  name: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
}

export interface UpdateTodoDTO {
  idUser: string;
  id: string;
  name?: string;
  description?: string;
  dueDate?: Date | null;
  status?: TodoStatus;
}
