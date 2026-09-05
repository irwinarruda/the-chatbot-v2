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
  deleteTodo: (id: string) => Promise<boolean>;
  clearTodoError: () => void;
}

export function createTodoSlice(
  service: typeof todoService = todoService,
): StateCreator<TodoSlice> {
  return (set, get) => {
    let listRequest = 0;
    let detailRequest = 0;
    return {
      todos: [],
      selectedTodo: undefined,
      isTodoBootstrapping: false,
      isTodoSubmitting: false,
      todoError: undefined,
      ...compute("todo", get, (state) => ({
        hasTodos: state.todos.length > 0,
        pendingTodoCount: state.todos.filter(
          (todo) => todo.status === "Pending",
        ).length,
        completedTodoCount: state.todos.filter(
          (todo) => todo.status === "Completed",
        ).length,
      })),
      async bootstrapTodos(filters) {
        const request = ++listRequest;
        set({
          isTodoBootstrapping: true,
          todoError: undefined,
        });
        try {
          const todos = await service.listTodos(filters);
          if (request === listRequest) set({ todos });
        } catch {
          if (request === listRequest) set({ todoError: "loading" });
        } finally {
          if (request === listRequest) set({ isTodoBootstrapping: false });
        }
      },
      async createTodo(input) {
        const { isTodoSubmitting } = get();
        const name = input.name.trim();
        if (!name || isTodoSubmitting) return undefined;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          const todo = await service.createTodo({
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
        const request = ++detailRequest;
        const { todos } = get();
        const existing = todos.find((todo) => todo.id === id);
        if (existing) {
          set({ selectedTodo: existing });
          return existing;
        }
        set({ todoError: undefined, selectedTodo: undefined });
        try {
          const todo = await service.getTodo(id);
          if (request !== detailRequest) return undefined;
          set({ selectedTodo: todo });
          return todo;
        } catch {
          if (request === detailRequest) {
            set({ todoError: "loading", selectedTodo: undefined });
          }
          return undefined;
        }
      },
      async updateTodo(id, patch) {
        const { isTodoSubmitting } = get();
        if (isTodoSubmitting) return undefined;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          const todo = await service.updateTodo(id, {
            name: patch.name,
            description: patch.description,
            dueDate: patch.dueDate,
            status: patch.status,
          });
          set((state) => {
            let selectedTodo = state.selectedTodo;
            if (selectedTodo?.id === id) selectedTodo = todo;
            return {
              todos: state.todos.map((item) => {
                if (item.id === id) return todo;
                return item;
              }),
              selectedTodo,
            };
          });
          return todo;
        } catch {
          set({ todoError: "saving" });
          return undefined;
        } finally {
          set({ isTodoSubmitting: false });
        }
      },
      async deleteTodo(id) {
        const { isTodoSubmitting } = get();
        if (isTodoSubmitting) return false;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          await service.deleteTodo(id);
          set((state) => {
            let selectedTodo = state.selectedTodo;
            if (selectedTodo?.id === id) selectedTodo = undefined;
            return {
              todos: state.todos.filter((todo) => todo.id !== id),
              selectedTodo,
            };
          });
          return true;
        } catch {
          set({ todoError: "deleting" });
          return false;
        } finally {
          set({ isTodoSubmitting: false });
        }
      },
      clearTodoError() {
        set({ todoError: undefined });
      },
    };
  };
}

export const todoSlice = createTodoSlice();
