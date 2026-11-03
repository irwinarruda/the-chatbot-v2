import type { Todo } from "~/domain/todos/todo";
import { TodoResponseDTO } from "./todo";

export function toTodoDueDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function toTodoResponse(todo: Todo): TodoResponseDTO {
  return TodoResponseDTO.parse(todo.toJSON());
}
