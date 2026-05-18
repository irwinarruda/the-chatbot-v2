import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { TodoService } from "~/server/services/TodoService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/web/todos/$todoId")({
  server: {
    handlers: {
      async GET({ context, params }) {
        const todoService =
          ServerBootstrap.getService<TodoService>("TodoService");
        const todo = await todoService.getTodoById(
          context.webAuth.userId,
          params.todoId,
        );
        return Http.json({ todo: todo.toJSON() });
      },
      async PATCH({ request, context, params }) {
        const todoService =
          ServerBootstrap.getService<TodoService>("TodoService");
        const body = await request.json();
        const patch: Parameters<typeof todoService.updateTodo>[0] = {
          idUser: context.webAuth.userId,
          id: params.todoId,
          name: body.name,
          description: body.description,
          status: body.status,
        };
        if ("due_date" in body) {
          patch.dueDate = body.due_date ? new Date(body.due_date) : undefined;
        }
        const todo = await todoService.updateTodo(patch);
        return Http.json({ todo: todo.toJSON() });
      },
      async DELETE({ context, params }) {
        const todoService =
          ServerBootstrap.getService<TodoService>("TodoService");
        await todoService.deleteTodo(context.webAuth.userId, params.todoId);
        return Http.ok();
      },
    },
  },
});
