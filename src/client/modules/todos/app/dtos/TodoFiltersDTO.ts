import type {
  TodoDueFilterDTO,
  TodoStatusDTO,
} from "~/contracts/http/todos/todo";

export interface TodoFiltersDTO {
  q?: string;
  dueDate?: string;
  due?: TodoDueFilterDTO;
  status?: "all" | TodoStatusDTO;
}
