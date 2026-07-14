import { describe, expect, test } from "vitest";
import { parseTodo } from "~/modules/todos/client/services/todoService";
import { toTodoResponse } from "~/modules/todos/contracts/TodoContractMapper";
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
  });
});
