import { CreateTodosToolDTO } from "~/modules/todos/entities/dtos/CreateTodosToolDTO";

describe("CreateTodosToolDTO", () => {
  test("rejects an empty todo list", () => {
    expect(() => CreateTodosToolDTO.parse({ todos: [] })).toThrow();
  });
});
