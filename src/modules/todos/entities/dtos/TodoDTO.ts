import { z } from "zod";
import { ChannelMessageResponseDTO } from "~/modules/chat/entities/dtos/ChatDTO";

export const TodoStatusDTO = z.enum(["Pending", "Completed"]);
export type TodoStatusDTO = z.infer<typeof TodoStatusDTO>;

export const TodoDueFilterDTO = z.enum([
  "all",
  "with_due_date",
  "without_due_date",
]);
export type TodoDueFilterDTO = z.infer<typeof TodoDueFilterDTO>;

export const TodoResponseDTO = z.object({
  id: z.string().uuid(),
  sourceMessage: ChannelMessageResponseDTO.optional(),
  name: z.string(),
  description: z.string(),
  dueDate: z.iso.datetime().optional(),
  status: TodoStatusDTO,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TodoResponseDTO = z.infer<typeof TodoResponseDTO>;
export type TodoDTO = TodoResponseDTO;

export const TodosResponseDTO = z.object({ todos: z.array(TodoResponseDTO) });
export type TodosResponseDTO = z.infer<typeof TodosResponseDTO>;

export const TodoItemResponseDTO = z.object({ todo: TodoResponseDTO });
export type TodoItemResponseDTO = z.infer<typeof TodoItemResponseDTO>;

export const SaveTodoRequestDTO = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.iso.datetime().optional(),
  status: TodoStatusDTO.optional(),
});

export type SaveTodoRequestDTO = z.infer<typeof SaveTodoRequestDTO>;

export const CreateTodoRequestDTO = SaveTodoRequestDTO.extend({
  name: z.string().trim().min(1),
});

export type CreateTodoRequestDTO = z.infer<typeof CreateTodoRequestDTO>;
