import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { TodoService } from "~/server/services/TodoService";
import { Http } from "~/server/utils/Http";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";

export const Route = createFileRoute("/api/v1/web/todos")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const todoService =
          ServerBootstrap.getService<TodoService>("TodoService");
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
        return Http.json({ todos: todos.map((todo) => todo.toJSON()) });
      },
      async POST({ request, context }) {
        const todoService =
          ServerBootstrap.getService<TodoService>("TodoService");
        const body = await request.json();
        const todo = await todoService.createTodo({
          idUser: context.webAuth.userId,
          name: body.name,
          description: body.description,
          dueDate: body.due_date ? new Date(body.due_date) : undefined,
          status: body.status,
        });
        return Http.json({ todo: todo.toJSON() });
      },
    },
  },
});
