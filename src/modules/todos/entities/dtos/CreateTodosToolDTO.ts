import { z } from "zod";
import { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";

export const CreateTodosToolDTO = z.object({
  todos: z
    .array(
      z.object({
        name: z.string().min(1).describe("Short actionable todo title"),
        description: z
          .string()
          .describe(
            "Optional detail. Leave empty when the title captures the whole request",
          )
          .optional(),
        dueDate: z.iso
          .date()
          .describe(
            "Optional ISO-8601 due date. Omit when the user does not provide a due date",
          )
          .optional(),
        status: z
          .enum([TodoStatus.Pending, TodoStatus.Completed])
          .describe("Initial todo status, normally Pending"),
      }),
    )
    .min(1)
    .describe("Todos extracted from the user message or recent context"),
});

export type CreateTodosToolDTO = z.infer<typeof CreateTodosToolDTO>;
