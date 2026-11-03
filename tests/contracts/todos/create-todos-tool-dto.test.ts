import { CreateTodosToolDTO } from "~/contracts/tools/todos/create-todos";

describe("CreateTodosToolDTO", () => {
  test("rejects an empty todo list", () => {
    expect(() => CreateTodosToolDTO.parse({ todos: [] })).toThrow();
  });
});
