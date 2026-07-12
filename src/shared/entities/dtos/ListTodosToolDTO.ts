import { z } from "zod";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";

export const ListTodosToolDTO = z.object({
  status: z
    .enum([TodoStatus.Pending, TodoStatus.Completed])
    .describe("Filter todos by status"),
});

export type ListTodosToolDTO = z.infer<typeof ListTodosToolDTO>;
