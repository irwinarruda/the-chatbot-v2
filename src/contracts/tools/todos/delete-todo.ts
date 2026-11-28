import { z } from "zod";

export const DeleteTodoToolDTO = z.object({
  todo_id: z.string().uuid().describe("Exact todo ID returned by list_todos"),
});

export type DeleteTodoToolDTO = z.infer<typeof DeleteTodoToolDTO>;
