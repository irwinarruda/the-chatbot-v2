import { describe, expect, test } from "vitest";
import { UpdateTodoToolDTO } from "~/contracts/tools/todos/update-todo";

const todoId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";

describe("update_todo tool input", () => {
  test("accepts a single changed field or a cleared due date", () => {
    expect(
      UpdateTodoToolDTO.parse({ todo_id: todoId, status: "Completed" }),
    ).toEqual({ todo_id: todoId, status: "Completed" });
    expect(
      UpdateTodoToolDTO.parse({ todo_id: todoId, clear_due_date: true }),
    ).toEqual({ todo_id: todoId, clear_due_date: true });
  });

  test("rejects an update that changes nothing or sets and clears the due date", () => {
    expect(() => UpdateTodoToolDTO.parse({ todo_id: todoId })).toThrow(
      "Send at least one field to change",
    );
    expect(() =>
      UpdateTodoToolDTO.parse({
        todo_id: todoId,
        due_date: "2026-12-01",
        clear_due_date: true,
      }),
    ).toThrow("Send due_date or clear_due_date, not both");
  });
});
