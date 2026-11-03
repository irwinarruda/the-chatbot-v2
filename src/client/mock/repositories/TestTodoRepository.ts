import { DemoNow, mockDb } from "~/client/mock/db";
import type { TodoFiltersDTO } from "~/client/modules/todos/app/dtos/TodoFiltersDTO";
import type { TodoRepository } from "~/client/modules/todos/app/repositories/TodoRepository";
import type {
  CreateTodoRequestDTO,
  SaveTodoRequestDTO,
  TodoResponseDTO,
} from "~/contracts/http/todos/todo";
import { NotFoundError } from "./NotFoundError";

export class TestTodoRepository implements TodoRepository {
  async listTodos(filters: TodoFiltersDTO = {}) {
    const query = filters.q?.trim().toLowerCase();
    return mockDb.todos.filter((todo) => {
      if (filters.status && filters.status !== "all") {
        if (todo.status !== filters.status) return false;
      }
      if (filters.due === "with_due_date" && !todo.dueDate) return false;
      if (filters.due === "without_due_date" && todo.dueDate) return false;
      if (filters.dueDate && !todo.dueDate?.startsWith(filters.dueDate)) {
        return false;
      }
      if (!query) return true;
      return `${todo.name} ${todo.description}`.toLowerCase().includes(query);
    });
  }

  async getTodo(id: string) {
    return findTodo(id);
  }

  async createTodo(dto: CreateTodoRequestDTO) {
    const todo: TodoResponseDTO = {
      id: crypto.randomUUID(),
      name: dto.name,
      description: dto.description ?? "",
      dueDate: dto.dueDate ? `${dto.dueDate}T12:00:00.000Z` : undefined,
      status: dto.status ?? "Pending",
      createdAt: DemoNow,
      updatedAt: DemoNow,
    };
    mockDb.todos.unshift(todo);
    return todo;
  }

  async updateTodo(id: string, dto: SaveTodoRequestDTO) {
    const todo = findTodo(id);
    if (dto.name !== undefined) todo.name = dto.name;
    if (dto.description !== undefined) todo.description = dto.description;
    if (dto.status !== undefined) todo.status = dto.status;
    if (dto.dueDate !== undefined) {
      todo.dueDate = dto.dueDate ? `${dto.dueDate}T12:00:00.000Z` : undefined;
    }
    todo.updatedAt = DemoNow;
    return todo;
  }

  async deleteTodo(id: string) {
    mockDb.todos = mockDb.todos.filter((todo) => todo.id !== id);
  }
}

function findTodo(id: string): TodoResponseDTO {
  const todo = mockDb.todos.find((candidate) => candidate.id === id);
  if (!todo) throw new NotFoundError("Todo not found");
  return todo;
}
