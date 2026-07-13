import { describe, expect, test } from "vitest";
import { Todo } from "~/modules/todos/domain/Todo";
import { toTodoResponse } from "~/modules/todos/server/TodoContractMapper";

describe("Todo contracts", () => {
  test("real todo serialization is accepted by the client contract", () => {
    const todo = new Todo({ idUser: crypto.randomUUID(), name: "Ship it" });

    expect(toTodoResponse(todo)).toEqual(todo.toJSON());
  });
});
