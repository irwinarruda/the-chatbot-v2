import { describe, expect, test } from "vitest";
import {
  parseTodo,
  toTodoDueDateInputValue,
} from "~/modules/todos/client/services/todoService";
import {
  toTodoDueDate,
  toTodoResponse,
} from "~/modules/todos/contracts/TodoContractMapper";
import {
  CreateTodoRequestDTO,
  SaveTodoRequestDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";
import { Todo } from "~/modules/todos/entities/Todo";
import { Printable } from "~/shared/http/utils/Printable";

describe("Todo contracts", () => {
  test("serialized API todos are mapped to the client contract", () => {
    const todo = new Todo({
      idUser: crypto.randomUUID(),
      name: "Ship it",
      dueDate: new Date("2026-07-14T12:00:00.000Z"),
    });
    const response = toTodoResponse(todo);
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse).toMatchObject({
      due_date: response.dueDate,
      created_at: response.createdAt,
      updated_at: response.updatedAt,
    });
    expect(parseTodo(wireResponse)).toEqual(response);
    expect(() =>
      parseTodo({ ...wireResponse, due_date: "2026-07-14" }),
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
