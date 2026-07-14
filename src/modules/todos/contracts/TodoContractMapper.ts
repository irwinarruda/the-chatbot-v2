import { TodoResponse } from "~/modules/todos/entities/dtos/TodoDTO";
import type { Todo } from "~/modules/todos/entities/Todo";

export function toTodoResponse(todo: Todo): TodoResponse {
  return TodoResponse.parse(todo.toJSON());
}
