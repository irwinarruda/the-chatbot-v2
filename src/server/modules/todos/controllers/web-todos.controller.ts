import { createFileRoute } from "@tanstack/react-router";
import {
  CreateTodoRequestDTO,
  TodosResponseDTO,
} from "~/contracts/http/todos/todo";
import {
  toTodoDueDate,
  toTodoResponse,
} from "~/contracts/http/todos/todo-mapper";
import { TodoStatus } from "~/domain/todos/todo-status";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/todos")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const todoService = getServer().services.todos;
        const url = new URL(request.url);
        const search = url.searchParams.get("q") ?? undefined;
        const due = url.searchParams.get("due") ?? undefined;
        const status = url.searchParams.get("status") ?? undefined;
        const dueDate = url.searchParams.get("dueDate") ?? undefined;
        const todos = await todoService.listTodos(context.webAuth.userId, {
          search,
          due:
            due === "with_due_date" || due === "without_due_date" ? due : "all",
          status:
            status === TodoStatus.Pending || status === TodoStatus.Completed
              ? status
              : undefined,
          dueDate: dueDate ? toTodoDueDate(dueDate) : undefined,
        });
        return Http.json(
          TodosResponseDTO.parse({ todos: todos.map(toTodoResponse) }),
        );
      },
      async POST({ request, context }) {
        const todoService = getServer().services.todos;
        const body = CreateTodoRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const todo = await todoService.createTodo({
          idUser: context.webAuth.userId,
          name: body.name,
          description: body.description,
          dueDate: body.dueDate ? toTodoDueDate(body.dueDate) : undefined,
          status: body.status,
        });
        return Http.json({ todo: toTodoResponse(todo) });
      },
    },
  },
});
