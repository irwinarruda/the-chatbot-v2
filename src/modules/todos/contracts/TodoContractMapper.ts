import { TodoResponseDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import type { Todo } from "~/modules/todos/entities/Todo";

export function toTodoDueDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function toTodoResponse(todo: Todo): TodoResponseDTO {
  return TodoResponseDTO.parse(todo.toJSON());
}
