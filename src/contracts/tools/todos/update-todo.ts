import { z } from "zod";
import { TodoStatus } from "~/domain/todos/todo-status";

export const UpdateTodoToolDTO = z
  .object({
    todo_id: z.string().uuid().describe("Exact todo ID returned by list_todos"),
    name: z.string().trim().min(1).describe("New todo title").optional(),
    description: z
      .string()
      .describe("New description. Send an empty string to clear it")
      .optional(),
    due_date: z.iso.date().describe("New ISO-8601 due date").optional(),
    clear_due_date: z
      .boolean()
      .describe("Set true to remove the due date")
      .optional(),
    status: z
      .enum([TodoStatus.Pending, TodoStatus.Completed])
      .describe("Completed to finish the todo, Pending to reopen it")
      .optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.due_date !== undefined ||
      input.clear_due_date === true ||
      input.status !== undefined,
    "Send at least one field to change",
  )
  .refine(
    (input) => !(input.due_date && input.clear_due_date),
    "Send due_date or clear_due_date, not both",
  );

export type UpdateTodoToolDTO = z.infer<typeof UpdateTodoToolDTO>;
