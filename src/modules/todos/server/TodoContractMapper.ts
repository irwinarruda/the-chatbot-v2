import { TodoResponse } from "~/modules/todos/contracts/TodoContracts";
import type { Todo } from "~/modules/todos/domain/Todo";

export function toTodoResponse(todo: Todo): TodoResponse {
  return TodoResponse.parse(todo.toJSON());
}
