import { z } from "zod";
import { TodoStatus } from "~/modules/todos/domain/enums/TodoStatus";

export const ListTodosToolDTO = z.object({
  status: z
    .enum([TodoStatus.Pending, TodoStatus.Completed])
    .describe("Filter todos by status"),
});

export type ListTodosToolDTO = z.infer<typeof ListTodosToolDTO>;
