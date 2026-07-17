import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { TodoFiltersDTO } from "~/modules/todos/client/entities/dtos/TodoFiltersDTO";
import { todoService } from "~/modules/todos/client/services/todoService";
import type {
  TodoDTO,
  TodoStatusDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";

export type TodoErrorCode = "loading" | "saving" | "deleting";

export interface TodoDraft {
  name: string;
  description: string;
  dueDate: string;
  status: TodoStatusDTO;
}

export interface TodoSlice {
  todos: TodoDTO[];
  selectedTodo?: TodoDTO;
  todoDraft: TodoDraft;
  isTodoBootstrapping: boolean;
  isTodoSubmitting: boolean;
  todoError?: TodoErrorCode;
  hasTodos: boolean;
  pendingTodoCount: number;
  completedTodoCount: number;
  canSaveTodoDraft: boolean;
  bootstrapTodos: (filters?: TodoFiltersDTO) => Promise<void>;
  setTodoDraft: (patch: Partial<TodoDraft>) => void;
  resetTodoDraft: () => void;
  createTodoFromDraft: () => Promise<TodoDTO | undefined>;
  loadTodo: (id: string) => Promise<TodoDTO | undefined>;
  updateTodo: (
    id: string,
    patch: Partial<Omit<TodoDraft, "dueDate">> & {
      dueDate?: string | null;
    },
  ) => Promise<TodoDTO | undefined>;
  deleteTodo: (id: string) => Promise<void>;
  clearTodoError: () => void;
}

const emptyDraft: TodoDraft = {
  name: "",
  description: "",
  dueDate: "",
  status: "Pending",
};

export const todoSlice: StateCreator<TodoSlice> = (set, get) => ({
  todos: [],
  selectedTodo: undefined,
  todoDraft: emptyDraft,
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
    canSaveTodoDraft:
      state.todoDraft.name.trim().length > 0 && !state.isTodoSubmitting,
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
  setTodoDraft(patch) {
    set((state) => ({ todoDraft: { ...state.todoDraft, ...patch } }));
  },
  resetTodoDraft() {
    set({ todoDraft: emptyDraft });
  },
  async createTodoFromDraft() {
    const { todoDraft, isTodoSubmitting } = get();
    const name = todoDraft.name.trim();
    if (!name || isTodoSubmitting) return undefined;
    set({ isTodoSubmitting: true, todoError: undefined });
    try {
      const todo = await todoService.createTodo({
        name,
        description: todoDraft.description,
        dueDate: todoDraft.dueDate || undefined,
        status: todoDraft.status,
      });
      set((state) => ({
        todos: [todo, ...state.todos],
        todoDraft: emptyDraft,
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
