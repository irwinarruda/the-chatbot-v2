import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { TodoFiltersDTO } from "~/modules/todos/client/entities/dtos/TodoFiltersDTO";
import { todoService } from "~/modules/todos/client/services/todoService";
import type {
  TodoDTO,
  TodoStatusDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";

export type TodoErrorCode = "loading" | "saving" | "deleting";

export interface TodoInput {
  name: string;
  description: string;
  dueDate?: string | null;
  status: TodoStatusDTO;
}

export interface TodoSlice {
  todos: TodoDTO[];
  selectedTodo?: TodoDTO;
  isTodoBootstrapping: boolean;
  isTodoSubmitting: boolean;
  todoError?: TodoErrorCode;
  hasTodos: boolean;
  pendingTodoCount: number;
  completedTodoCount: number;
  bootstrapTodos: (filters?: TodoFiltersDTO) => Promise<void>;
  createTodo: (input: TodoInput) => Promise<TodoDTO | undefined>;
  loadTodo: (id: string) => Promise<TodoDTO | undefined>;
  updateTodo: (
    id: string,
    patch: Partial<TodoInput>,
  ) => Promise<TodoDTO | undefined>;
  deleteTodo: (id: string) => Promise<void>;
  clearTodoError: () => void;
}

export const todoSlice: StateCreator<TodoSlice> = (set, get) => ({
  todos: [],
  selectedTodo: undefined,
  isTodoBootstrapping: false,
  isTodoSubmitting: false,
  todoError: undefined,
  ...compute("todo", get, (state) => ({
    hasTodos: state.todos.length > 0,
    pendingTodoCount: state.todos.filter((todo) => todo.status === "Pending")
      .length,
    completedTodoCount: state.todos.filter(
      (todo) => todo.status === "Completed",
    ).length,
  })),
  async bootstrapTodos(filters) {
    set({
      isTodoBootstrapping: true,
      todoError: undefined,
    });
    try {
      const todos = await todoService.listTodos(filters);
      set({ todos });
    } catch {
      set({ todoError: "loading" });
    } finally {
      set({ isTodoBootstrapping: false });
    }
  },
  async createTodo(input) {
    const { isTodoSubmitting } = get();
    const name = input.name.trim();
    if (!name || isTodoSubmitting) return undefined;
    set({ isTodoSubmitting: true, todoError: undefined });
    try {
      const todo = await todoService.createTodo({
        name,
        description: input.description,
        dueDate: input.dueDate || undefined,
        status: input.status,
      });
      set((state) => ({
        todos: [todo, ...state.todos],
      }));
      return todo;
    } catch {
      set({ todoError: "saving" });
      return undefined;
    } finally {
      set({ isTodoSubmitting: false });
    }
  },
  async loadTodo(id) {
    const { todos } = get();
    const existing = todos.find((todo) => todo.id === id);
    if (existing) {
      set({ selectedTodo: existing });
      return existing;
    }
    set({ todoError: undefined });
    try {
      const todo = await todoService.getTodo(id);
      set({ selectedTodo: todo });
      return todo;
    } catch {
      set({ todoError: "loading", selectedTodo: undefined });
      return undefined;
    }
  },
  async updateTodo(id, patch) {
    const { isTodoSubmitting } = get();
    if (isTodoSubmitting) return undefined;
    set({ isTodoSubmitting: true, todoError: undefined });
    try {
      const todo = await todoService.updateTodo(id, {
        name: patch.name,
        description: patch.description,
        dueDate: patch.dueDate,
        status: patch.status,
      });
      set((state) => ({
        todos: state.todos.map((item) => (item.id === id ? todo : item)),
        selectedTodo: todo,
      }));
      return todo;
    } catch {
      set({ todoError: "saving" });
      return undefined;
    } finally {
      set({ isTodoSubmitting: false });
    }
  },
  async deleteTodo(id) {
    set({ isTodoSubmitting: true, todoError: undefined });
    try {
      await todoService.deleteTodo(id);
      set((state) => ({
        todos: state.todos.filter((todo) => todo.id !== id),
        selectedTodo:
          state.selectedTodo?.id === id ? undefined : state.selectedTodo,
      }));
    } catch {
      set({ todoError: "deleting" });
    } finally {
      set({ isTodoSubmitting: false });
    }
  },
  clearTodoError() {
    set({ todoError: undefined });
  },
});
