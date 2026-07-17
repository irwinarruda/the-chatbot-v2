import { afterEach, describe, expect, test, vi } from "vitest";
import {
  todoService,
  toTodoDueDateRequestValue,
} from "~/modules/todos/client/services/todoService";

const todoId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";
const todoResponse = {
  todo: {
    id: todoId,
    name: "Ship it",
    description: "",
    status: "Pending",
    created_at: "2026-07-14T12:00:00.000Z",
    updated_at: "2026-07-14T12:00:00.000Z",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("todoService", () => {
  test("serializes omitted, cleared, and date-only due dates distinctly", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json(todoResponse, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await todoService.updateTodo(todoId, { status: "Completed" });
    await todoService.updateTodo(todoId, { dueDate: null });
    await todoService.updateTodo(todoId, { dueDate: "2026-07-15" });

    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(requestBodies[0]).not.toHaveProperty("dueDate");
    expect(requestBodies[1]).toMatchObject({ dueDate: null });
    expect(requestBodies[2]).toMatchObject({ dueDate: "2026-07-15" });
  });

  test("maps an empty date input to an explicit clear value", () => {
    expect(toTodoDueDateRequestValue("")).toBeNull();
    expect(toTodoDueDateRequestValue("2026-07-15")).toBe("2026-07-15");
  });
});
