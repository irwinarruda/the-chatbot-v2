import type { TodoFiltersDTO } from "~/client/modules/todos/app/dtos/TodoFiltersDTO";
import type {
  CreateTodoRequestDTO,
  SaveTodoRequestDTO,
  TodoResponseDTO,
} from "~/contracts/http/todos/todo";

export interface TodoRepository {
  listTodos(filters?: TodoFiltersDTO): Promise<TodoResponseDTO[]>;
  getTodo(id: string): Promise<TodoResponseDTO>;
  createTodo(dto: CreateTodoRequestDTO): Promise<TodoResponseDTO>;
  updateTodo(id: string, dto: SaveTodoRequestDTO): Promise<TodoResponseDTO>;
  deleteTodo(id: string): Promise<void>;
}
