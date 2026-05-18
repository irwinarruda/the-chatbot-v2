import type { Todo, TodoDueFilter, TodoStatus } from "~/client/entities/Todo";
import { parseChatMessage, type WireChatMessage } from "./webChatService";

export interface TodoFilters {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilter;
  status?: "all" | TodoStatus;
}

export interface TodoSaveDto {
  name?: string;
  description?: string;
  dueDate?: string;
  status?: TodoStatus;
}

type WireTodo = {
  id: string;
  source_message?: WireChatMessage;
  name: string;
  description: string;
  due_date?: string;
  status: TodoStatus;
  created_at: string;
  updated_at: string;
};

function parseTodo(todo: WireTodo): Todo {
  return {
    id: todo.id,
    sourceMessage: todo.source_message
      ? parseChatMessage(todo.source_message)
      : undefined,
    name: todo.name,
    description: todo.description,
    dueDate: todo.due_date ?? undefined,
    status: todo.status,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

function toWireDto(dto: TodoSaveDto) {
  return {
    name: dto.name,
    description: dto.description,
    due_date: dto.dueDate,
    status: dto.status,
  };
}

export const todoService = {
  async listTodos(filters: TodoFilters = {}): Promise<Todo[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.dueDate) params.set("dueDate", filters.dueDate);
    if (filters.due && filters.due !== "all") params.set("due", filters.due);
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    const url = `/api/v1/web/todos${params.size ? `?${params}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("listTodos failed");
    const data = await res.json();
    return ((data.todos ?? []) as WireTodo[]).map(parseTodo);
  },

  async getTodo(id: string): Promise<Todo> {
    const res = await fetch(`/api/v1/web/todos/${id}`);
    if (!res.ok) throw new Error("getTodo failed");
    const data = await res.json();
    return parseTodo(data.todo as WireTodo);
  },

  async createTodo(dto: TodoSaveDto): Promise<Todo> {
    const res = await fetch("/api/v1/web/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toWireDto(dto)),
    });
    if (!res.ok) throw new Error("createTodo failed");
    const data = await res.json();
    return parseTodo(data.todo as WireTodo);
  },

  async updateTodo(id: string, dto: TodoSaveDto): Promise<Todo> {
    const res = await fetch(`/api/v1/web/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toWireDto(dto)),
    });
    if (!res.ok) throw new Error("updateTodo failed");
    const data = await res.json();
    return parseTodo(data.todo as WireTodo);
  },

  async deleteTodo(id: string): Promise<void> {
    const res = await fetch(`/api/v1/web/todos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("deleteTodo failed");
  },
};
