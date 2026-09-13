import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import type { todoService } from "~/modules/todos/client/services/todoService";
import {
  createTodoSlice,
  type TodoSlice,
} from "~/modules/todos/client/state/todoSlice";
import type { TodoDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { createDeferred } from "~/tests/utils/createDeferred";

const firstTodo: TodoDTO = {
  id: "first",
  name: "First",
  description: "First text",
  status: "Pending",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};
const secondTodo: TodoDTO = { ...firstTodo, id: "second", name: "Second" };

function createService() {
  return {
    listTodos: vi.fn<typeof todoService.listTodos>(async () => []),
    getTodo: vi.fn<typeof todoService.getTodo>(async () => firstTodo),
    createTodo: vi.fn<typeof todoService.createTodo>(async () => firstTodo),
    updateTodo: vi.fn<typeof todoService.updateTodo>(async () => firstTodo),
    deleteTodo: vi.fn<typeof todoService.deleteTodo>(async () => {}),
  };
}

describe("todoSlice", () => {
  test("keeps the newest search and ignores an older failed request", async () => {
    const pending = createDeferred<TodoDTO[]>();
    const service = createService();
    service.listTodos
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([secondTodo]);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    const first = store.getState().bootstrapTodos({ q: "first" });
    await store.getState().bootstrapTodos({ q: "second" });
    pending.reject(new Error("Old request failed"));
    await first;
    expect(store.getState().todos).toEqual([secondTodo]);
    expect(store.getState().todoError).toBeUndefined();
    expect(store.getState().isTodoBootstrapping).toBe(false);
  });

  test("does not finish loading when an older search resolves first", async () => {
    const first = createDeferred<TodoDTO[]>();
    const second = createDeferred<TodoDTO[]>();
    const service = createService();
    service.listTodos
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    const firstLoad = store.getState().bootstrapTodos({ q: "first" });
    const secondLoad = store.getState().bootstrapTodos({ q: "second" });
    first.resolve([firstTodo]);
    await firstLoad;
    expect(store.getState().isTodoBootstrapping).toBe(true);
    expect(store.getState().todos).toEqual([]);
    second.resolve([secondTodo]);
    await secondLoad;
    expect(store.getState().todos).toEqual([secondTodo]);
  });

  test("ignores a detail response after selecting another cached todo", async () => {
    const pending = createDeferred<TodoDTO>();
    const service = createService();
    service.getTodo.mockReturnValueOnce(pending.promise);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    store.setState({ todos: [secondTodo], selectedTodo: firstTodo });
    const firstLoad = store.getState().loadTodo(firstTodo.id);
    expect(store.getState().selectedTodo).toBeUndefined();
    await store.getState().loadTodo(secondTodo.id);
    pending.resolve(firstTodo);
    await firstLoad;
    expect(store.getState().selectedTodo).toEqual(secondTodo);
  });

  test("preserves another selected todo when saving or deleting completes", async () => {
    const pending = createDeferred<TodoDTO>();
    const service = createService();
    service.updateTodo.mockReturnValueOnce(pending.promise);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    store.setState({ todos: [firstTodo, secondTodo], selectedTodo: firstTodo });
    const saving = store
      .getState()
      .updateTodo(firstTodo.id, { name: "Updated" });
    await store.getState().loadTodo(secondTodo.id);
    pending.resolve({ ...firstTodo, name: "Updated" });
    await saving;
    expect(store.getState().selectedTodo).toEqual(secondTodo);
    expect(await store.getState().deleteTodo(firstTodo.id)).toBe(true);
    expect(store.getState().selectedTodo).toEqual(secondTodo);
  });
  test("reset rejects a pending delete and its error without affecting a new submission", async () => {
    const deletion = createDeferred<void>();
    const creation = createDeferred<TodoDTO>();
    const service = createService();
    service.deleteTodo.mockReturnValueOnce(deletion.promise);
    service.createTodo.mockReturnValueOnce(creation.promise);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    store.setState({ todos: [firstTodo] });
    const old = store.getState().deleteTodo(firstTodo.id);
    store.getState().resetTodos();
    const current = store
      .getState()
      .createTodo({ name: "Second", description: "", status: "Pending" });
    deletion.reject(new Error("Old error"));
    expect(await old).toBe(false);
    expect(store.getState().todoError).toBeUndefined();
    expect(store.getState().isTodoSubmitting).toBe(true);
    creation.resolve(secondTodo);
    await current;
    expect(store.getState().todos).toEqual([secondTodo]);
  });

  test("a stale list cannot restore a deleted todo", async () => {
    const list = createDeferred<TodoDTO[]>();
    const service = createService();
    service.listTodos.mockReturnValueOnce(list.promise);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    store.setState({ todos: [firstTodo] });
    const loading = store.getState().bootstrapTodos();
    await store.getState().deleteTodo(firstTodo.id);
    list.resolve([firstTodo]);
    await loading;
    expect(store.getState().todos).toEqual([]);
  });
});

describe("Todo list and write ordering", () => {
  test.each(["list-first", "write-first", "write-failed"] as const)(
    "retains existing records when the initial load overlaps a create: %s",
    async (order) => {
      const list = createDeferred<TodoDTO[]>();
      const write = createDeferred<TodoDTO>();
      const service = createService();
      service.listTodos
        .mockReturnValueOnce(list.promise)
        .mockResolvedValue([firstTodo, secondTodo]);
      service.createTodo.mockReturnValueOnce(write.promise);
      const store = create<TodoSlice>()(computed(createTodoSlice(service)));
      const loading = store.getState().bootstrapTodos();
      const creating = store
        .getState()
        .createTodo({ name: "First", description: "", status: "Pending" });
      expect(store.getState().isTodoBootstrapping).toBe(true);
      if (order === "list-first") {
        list.resolve([secondTodo]);
        await loading;
      }
      if (order === "write-failed") write.reject(new Error("Write failed"));
      else write.resolve(firstTodo);
      await creating;
      if (order !== "list-first") {
        list.resolve([secondTodo]);
        await loading;
      }
      if (order === "write-failed") {
        expect(store.getState().todos).toEqual([secondTodo]);
        expect(store.getState().todoError).toBe("saving");
      } else expect(store.getState().todos).toEqual([firstTodo, secondTodo]);
      expect(store.getState().isTodoBootstrapping).toBe(false);
      expect(store.getState().isTodoSubmitting).toBe(false);
    },
  );

  test("refreshes the current search after an earlier create without opening its detail", async () => {
    const write = createDeferred<TodoDTO>();
    const service = createService();
    service.createTodo.mockReturnValueOnce(write.promise);
    service.listTodos.mockResolvedValue([secondTodo]);
    const store = create<TodoSlice>()(computed(createTodoSlice(service)));
    const creating = store
      .getState()
      .createTodo({ name: "First", description: "", status: "Pending" });
    await store.getState().bootstrapTodos({ q: "Second" });
    write.resolve(firstTodo);
    expect(await creating).toBeUndefined();
    expect(store.getState().todos).toEqual([secondTodo]);
    expect(service.listTodos).toHaveBeenLastCalledWith({ q: "Second" });
    expect(store.getState().selectedTodo).toBeUndefined();
  });
});
