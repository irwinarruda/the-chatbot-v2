import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { TodoFiltersDTO } from "~/modules/todos/client/entities/dtos/TodoFiltersDTO";
import { todoService } from "~/modules/todos/client/services/todoService";
import type {
  TodoDTO,
  TodoStatusDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";
import { type ApiError, clientError } from "~/shared/client/services/ApiClient";

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
  todoError?: TodoErrorCode | ApiError;
  resetTodos: () => void;
  closeTodo: () => void;
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
    let generation = 0;
    let view = 0;
    let listRequest = 0;
    let currentFilters: TodoFiltersDTO | undefined;
    let detailRequest = 0;
    let detailTarget: string | undefined;
    async function reconcileTodos(
      requestGeneration: number,
      previousListRequest: number,
    ) {
      const { isTodoBootstrapping } = get();
      if (!isTodoBootstrapping && listRequest === previousListRequest)
        return false;
      do {
        const { bootstrapTodos } = get();
        await bootstrapTodos(currentFilters);
        const { isTodoBootstrapping } = get();
        if (!isTodoBootstrapping) break;
      } while (requestGeneration === generation);
      return true;
    }
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
      resetTodos() {
        detailTarget = undefined;
        generation += 1;
        listRequest += 1;
        detailRequest += 1;
        view += 1;

        set({
          todos: [],
          selectedTodo: undefined,
          isTodoBootstrapping: false,
          isTodoSubmitting: false,
          todoError: undefined,
        });
      },
      closeTodo() {
        detailTarget = undefined;
        view += 1;
        detailRequest += 1;

        set({ selectedTodo: undefined });
      },
      async bootstrapTodos(filters) {
        if (
          currentFilters?.q !== filters?.q ||
          currentFilters?.dueDate !== filters?.dueDate ||
          currentFilters?.due !== filters?.due ||
          currentFilters?.status !== filters?.status
        )
          view += 1;
        currentFilters = filters;
        const request = ++listRequest;
        set({
          isTodoBootstrapping: true,
          todoError: undefined,
        });
        try {
          const todos = await service.listTodos(filters);
          if (request === listRequest) set({ todos });
        } catch (error) {
          if (request === listRequest)
            set({ todoError: clientError(error, "loading") });
        } finally {
          if (request === listRequest) set({ isTodoBootstrapping: false });
        }
      },
      async createTodo(input) {
        const { isTodoSubmitting } = get();
        const name = input.name.trim();
        if (!name || isTodoSubmitting) return undefined;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          const todo = await service.createTodo({
            name,
            description: input.description,
            dueDate: input.dueDate || undefined,
            status: input.status,
          });
          if (requestGeneration !== generation) return undefined;
          const refreshed = await reconcileTodos(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return undefined;
          if (!refreshed)
            set((state) => ({
              todos: [
                todo,
                ...state.todos.filter((item) => item.id !== todo.id),
              ],
            }));
          if (requestView !== view) return undefined;
          return todo;
        } catch (error) {
          if (requestGeneration !== generation) return undefined;
          set({ todoError: clientError(error, "saving") });
          return undefined;
        } finally {
          if (requestGeneration === generation)
            set({ isTodoSubmitting: false });
        }
      },
      async loadTodo(id) {
        detailTarget = id;
        view += 1;
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
        } catch (error) {
          if (request === detailRequest) {
            set({
              todoError: clientError(error, "loading"),
              selectedTodo: undefined,
            });
          }
          return undefined;
        }
      },
      async updateTodo(id, patch) {
        const { isTodoSubmitting } = get();
        if (isTodoSubmitting) return undefined;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          const todo = await service.updateTodo(id, {
            name: patch.name,
            description: patch.description,
            dueDate: patch.dueDate,
            status: patch.status,
          });
          if (requestGeneration !== generation) return undefined;
          const refreshed = await reconcileTodos(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return undefined;
          if (detailTarget === id) detailRequest += 1;
          set((state) => {
            let selectedTodo = state.selectedTodo;
            if (selectedTodo?.id === id || detailTarget === id)
              selectedTodo = todo;
            let todos = state.todos;
            if (!refreshed)
              todos = state.todos.map((item) => {
                if (item.id === id) return todo;
                return item;
              });
            return {
              todos,
              selectedTodo,
            };
          });
          if (requestView !== view) return undefined;
          return todo;
        } catch (error) {
          if (requestGeneration !== generation) return undefined;
          set({ todoError: clientError(error, "saving") });
          return undefined;
        } finally {
          if (requestGeneration === generation)
            set({ isTodoSubmitting: false });
        }
      },
      async deleteTodo(id) {
        const { isTodoSubmitting } = get();
        if (isTodoSubmitting) return false;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isTodoSubmitting: true, todoError: undefined });
        try {
          await service.deleteTodo(id);
          if (requestGeneration !== generation) return false;
          const refreshed = await reconcileTodos(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return false;
          if (detailTarget === id) detailRequest += 1;
          set((state) => {
            let selectedTodo = state.selectedTodo;
            if (selectedTodo?.id === id || detailTarget === id)
              selectedTodo = undefined;
            let todos = state.todos;
            if (!refreshed)
              todos = state.todos.filter((todo) => todo.id !== id);
            return {
              todos,
              selectedTodo,
            };
          });
          return requestView === view;
        } catch (error) {
          if (requestGeneration !== generation) return false;
          set({ todoError: clientError(error, "deleting") });
          return false;
        } finally {
          if (requestGeneration === generation)
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
