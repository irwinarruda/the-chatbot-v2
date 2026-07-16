import { TodoResponseDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import type { Todo } from "~/modules/todos/entities/Todo";

export function toTodoResponse(todo: Todo): TodoResponseDTO {
  return TodoResponseDTO.parse(todo.toJSON());
}
