import { describe, expect, test } from "vitest";
import { parseTodo } from "~/client/modules/todos/app/repositories/ApiTodoRepository";
import { toTodoDueDateInputValue } from "~/client/modules/todos/parsers/TodoDueDate";
import {
  CreateTodoRequestDTO,
  SaveTodoRequestDTO,
} from "~/contracts/http/todos/todo";
import {
  toTodoDueDate,
  toTodoResponse,
} from "~/contracts/http/todos/todo-mapper";
import { Todo } from "~/domain/todos/todo";

describe("Todo contracts", () => {
  test("serialized API todos are mapped to the client contract", () => {
    const todo = new Todo({
      idUser: crypto.randomUUID(),
      name: "Ship it",
      dueDate: new Date("2026-07-14T12:00:00.000Z"),
    });
    const response = toTodoResponse(todo);
    const wireResponse = JSON.parse(JSON.stringify(response));

    expect(wireResponse).toMatchObject({
      dueDate: response.dueDate,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    });
    expect(parseTodo(wireResponse)).toEqual(response);
    expect(() =>
      parseTodo({ ...wireResponse, dueDate: "2026-07-14" }),
    ).toThrow();
    expect(toTodoDueDateInputValue(response.dueDate)).toBe("2026-07-14");
  });

  test("save requests accept calendar dates, explicit clearing, and omission", () => {
    expect(SaveTodoRequestDTO.parse({ dueDate: "2026-07-14" })).toEqual({
      dueDate: "2026-07-14",
    });
    expect(SaveTodoRequestDTO.parse({ dueDate: null })).toEqual({
      dueDate: null,
    });
    expect(SaveTodoRequestDTO.parse({})).not.toHaveProperty("dueDate");
    expect(() =>
      SaveTodoRequestDTO.parse({ dueDate: "2026-07-14T12:00:00.000Z" }),
    ).toThrow();
    expect(
      CreateTodoRequestDTO.parse({ name: "Ship it", dueDate: "2026-07-14" }),
    ).toMatchObject({ dueDate: "2026-07-14" });
    expect(() =>
      CreateTodoRequestDTO.parse({ name: "Ship it", dueDate: null }),
    ).toThrow();
  });

  test("calendar dates map to stable UTC storage and form values", () => {
    const dueDate = toTodoDueDate("2026-07-14");

    expect(dueDate.toISOString()).toBe("2026-07-14T12:00:00.000Z");
    expect(toTodoDueDateInputValue(dueDate.toISOString())).toBe("2026-07-14");
    expect(toTodoDueDateInputValue()).toBe("");
  });
});
