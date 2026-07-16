import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toTodoResponse } from "~/modules/todos/contracts/TodoContractMapper";
import {
  CreateTodoRequestDTO,
  TodosResponseDTO,
} from "~/modules/todos/entities/dtos/TodoDTO";
import { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/todos")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const todoService = ServerBootstrap.getApplication().services.todos;
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
          dueDate: dueDate ? new Date(dueDate) : undefined,
        });
        return Http.json(
          TodosResponseDTO.parse({ todos: todos.map(toTodoResponse) }),
        );
      },
      async POST({ request, context }) {
        const todoService = ServerBootstrap.getApplication().services.todos;
        const body = CreateTodoRequestDTO.parse(await request.json());
        const todo = await todoService.createTodo({
          idUser: context.webAuth.userId,
          name: body.name,
          description: body.description,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          status: body.status,
        });
        return Http.json({ todo: toTodoResponse(todo) });
      },
    },
  },
});
