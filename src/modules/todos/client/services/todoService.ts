import type { TodoFiltersDTO } from "~/modules/todos/client/entities/dtos/TodoFiltersDTO";
import {
  type CreateTodoRequestDTO,
  type SaveTodoRequestDTO,
  TodoItemResponseDTO,
  TodoResponseDTO,
  TodosResponseDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";
import { apiClient } from "~/shared/client/services/ApiClient";

export function parseTodo(data: unknown): TodoResponseDTO {
  return TodoResponseDTO.parse(data);
}

export function toTodoDueDateInputValue(dueDate?: string): string {
  return dueDate?.slice(0, 10) ?? "";
}

export function toTodoDueDateRequestValue(dueDate: string): string | null {
  return dueDate || null;
}

export const todoService = {
  async listTodos(filters: TodoFiltersDTO = {}): Promise<TodoResponseDTO[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.dueDate) params.set("dueDate", filters.dueDate);
    if (filters.due && filters.due !== "all") params.set("due", filters.due);
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    const url = `/api/v1/web/todos${params.size ? `?${params}` : ""}`;
    const response = await apiClient.request(url);
    return TodosResponseDTO.parse(await response.json()).todos;
  },

  async getTodo(id: string): Promise<TodoResponseDTO> {
    const response = await apiClient.request(`/api/v1/web/todos/${id}`);
    return TodoItemResponseDTO.parse(await response.json()).todo;
  },

  async createTodo(dto: CreateTodoRequestDTO): Promise<TodoResponseDTO> {
    const response = await apiClient.request("/api/v1/web/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return TodoItemResponseDTO.parse(await response.json()).todo;
  },

  async updateTodo(
    id: string,
    dto: SaveTodoRequestDTO,
  ): Promise<TodoResponseDTO> {
    const response = await apiClient.request(`/api/v1/web/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return TodoItemResponseDTO.parse(await response.json()).todo;
  },

  async deleteTodo(id: string): Promise<void> {
    await apiClient.request(`/api/v1/web/todos/${id}`, {
      method: "DELETE",
    });
  },
};
