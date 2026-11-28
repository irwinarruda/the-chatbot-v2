import { CreateTodosToolDTO } from "~/contracts/tools/todos/create-todos";
import { DeleteTodoToolDTO } from "~/contracts/tools/todos/delete-todo";
import { ListTodosToolDTO } from "~/contracts/tools/todos/list-todos";
import { UpdateTodoToolDTO } from "~/contracts/tools/todos/update-todo";
import { ToolRisk, ToolTopic } from "~/domain/chat/tool-exposure";
import {
  parseToolDate,
  type RegisteredTool,
  requireToolUser,
} from "~/server/modules/chat/services/tool-executor.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type { TodoService } from "~/server/modules/todos/services/todo.service";

export function createTodoTools(
  auth: AuthService,
  todoService: TodoService,
): RegisteredTool[] {
  return [
    {
      name: "create_todos",
      description: [
        "Create one or more todos for the authenticated user.",
        "Use this only for actionable tasks the user intends to complete, especially when a date or deadline is involved.",
        "Use create_note instead for ideas, references, links, durable prose, or information saved without a concrete action.",
        "One message may contain multiple todos. Extract each actionable item.",
        "Prefer one call with multiple todo objects when there is more than one.",
        "Use a short, clear, action-oriented name.",
        "Add description only when important details would be lost from the name.",
        "Set dueDate only when the user explicitly gives or clearly implies a date.",
        "Do not create todos for casual conversation unless the intent to save an action is clear.",
        "Returns { message, todos }.",
      ].join("\n"),
      inputSchema: CreateTodosToolDTO,
      mutating: true,
      external: { topic: ToolTopic.Todos, risk: ToolRisk.Write },
      run: async (args, context) => {
        const input = CreateTodosToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const created = await todoService.createTodos(
          input.todos.map((todo) => ({
            idUser: user.id,
            idSourceMessage: context.idSourceMessage,
            name: todo.name,
            description: todo.description,
            dueDate: parseToolDate(todo.dueDate),
            status: todo.status,
          })),
        );
        return {
          message: "Todos created",
          todos: created.map((todo) => todo.toJSON()),
        };
      },
    },
    {
      name: "list_todos",
      description:
        "List todos for the user filtered by status. Returns { count, todos }.",
      inputSchema: ListTodosToolDTO,
      mutating: false,
      external: { topic: ToolTopic.Todos, risk: ToolRisk.Read },
      run: async (args, context) => {
        const input = ListTodosToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const todos = await todoService.listTodos(user.id, {
          status: input.status,
        });
        return { count: todos.length, todos: todos.map((t) => t.toJSON()) };
      },
    },
    {
      name: "update_todo",
      description: [
        "Change one todo: rename it, change its description, set or clear its due date, or complete or reopen it.",
        "Use the exact ID returned by list_todos. Send only the fields that change.",
        "Returns { message, todo }.",
      ].join("\n"),
      inputSchema: UpdateTodoToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Todos,
        risk: ToolRisk.Write,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const input = UpdateTodoToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const todo = await todoService.updateTodo({
          idUser: user.id,
          id: input.todo_id,
          name: input.name,
          description: input.description,
          dueDate: input.clear_due_date ? null : parseToolDate(input.due_date),
          status: input.status,
        });
        return { message: "Todo updated", todo: todo.toJSON() };
      },
    },
    {
      name: "delete_todo",
      description:
        "Permanently delete one todo by the exact ID returned by list_todos. Returns { message }.",
      inputSchema: DeleteTodoToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Todos,
        risk: ToolRisk.Destructive,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const input = DeleteTodoToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await todoService.deleteTodo(user.id, input.todo_id);
        return { message: "Todo deleted" };
      },
    },
  ];
}
