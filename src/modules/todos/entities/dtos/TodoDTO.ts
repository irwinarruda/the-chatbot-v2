import { z } from "zod";
import { ChannelMessageResponse } from "~/modules/chat/entities/dtos/ChatDTO";

export const TodoStatus = z.enum(["Pending", "Completed"]);
export type TodoStatus = z.infer<typeof TodoStatus>;

export const TodoDueFilter = z.enum([
  "all",
  "with_due_date",
  "without_due_date",
]);
export type TodoDueFilter = z.infer<typeof TodoDueFilter>;

export const TodoResponse = z.object({
  id: z.string().uuid(),
  sourceMessage: ChannelMessageResponse.optional(),
  name: z.string(),
  description: z.string(),
  dueDate: z.iso.datetime().optional(),
  status: TodoStatus,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TodoResponse = z.infer<typeof TodoResponse>;
export type Todo = TodoResponse;

export const TodosResponse = z.object({ todos: z.array(TodoResponse) });
export type TodosResponse = z.infer<typeof TodosResponse>;

export const TodoItemResponse = z.object({ todo: TodoResponse });
export type TodoItemResponse = z.infer<typeof TodoItemResponse>;

export const SaveTodoRequest = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.iso.datetime().optional(),
  status: TodoStatus.optional(),
});

export type SaveTodoRequest = z.infer<typeof SaveTodoRequest>;

export const CreateTodoRequest = SaveTodoRequest.extend({
  name: z.string().trim().min(1),
});

export type CreateTodoRequest = z.infer<typeof CreateTodoRequest>;
