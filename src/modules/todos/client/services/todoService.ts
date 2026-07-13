import {
  type SaveTodoRequest,
  type TodoDueFilter,
  TodoItemResponse,
  type TodoResponse,
  type TodoStatus,
  TodosResponse,
} from "~/modules/todos/contracts/TodoContracts";
import { ApiErrorResponse } from "~/shared/contracts/ApiErrorContract";

export interface TodoFilters {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilter;
  status?: "all" | TodoStatus;
}

export type TodoSaveDto = SaveTodoRequest;

async function parseError(response: Response): Promise<Error> {
  const body = ApiErrorResponse.safeParse(await response.json());
  return new Error(
    body.success ? body.data.message : `Request failed with ${response.status}`,
  );
}

export const todoService = {
  async listTodos(filters: TodoFilters = {}): Promise<TodoResponse[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.dueDate) params.set("dueDate", filters.dueDate);
    if (filters.due && filters.due !== "all") params.set("due", filters.due);
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    const url = `/api/v1/web/todos${params.size ? `?${params}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw await parseError(response);
    return TodosResponse.parse(await response.json()).todos;
  },

  async getTodo(id: string): Promise<TodoResponse> {
    const response = await fetch(`/api/v1/web/todos/${id}`);
    if (!response.ok) throw await parseError(response);
    return TodoItemResponse.parse(await response.json()).todo;
  },

  async createTodo(dto: TodoSaveDto): Promise<TodoResponse> {
    const response = await fetch("/api/v1/web/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return TodoItemResponse.parse(await response.json()).todo;
  },

  async updateTodo(id: string, dto: TodoSaveDto): Promise<TodoResponse> {
    const response = await fetch(`/api/v1/web/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return TodoItemResponse.parse(await response.json()).todo;
  },

  async deleteTodo(id: string): Promise<void> {
    const response = await fetch(`/api/v1/web/todos/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },
};
