import type {
  TodoDueFilterDTO,
  TodoStatusDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";

export interface TodoFiltersDTO {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilterDTO;
  status?: "all" | TodoStatusDTO;
}
