import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toTodoResponse } from "~/modules/todos/contracts/TodoContractMapper";
import { SaveTodoRequestDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/todos/$todoId")({
  server: {
    handlers: {
      async GET({ context, params }) {
        const todoService = ServerBootstrap.getApplication().services.todos;
        const todo = await todoService.getTodoById(
          context.webAuth.userId,
          params.todoId,
        );
        return Http.json({ todo: toTodoResponse(todo) });
      },
      async PATCH({ request, context, params }) {
        const todoService = ServerBootstrap.getApplication().services.todos;
        const body = SaveTodoRequestDTO.parse(await parseJsonRequest(request));
        const patch: Parameters<typeof todoService.updateTodo>[0] = {
          idUser: context.webAuth.userId,
          id: params.todoId,
          name: body.name,
          description: body.description,
          status: body.status,
        };
        if ("dueDate" in body) {
          patch.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
        }
        const todo = await todoService.updateTodo(patch);
        return Http.json({ todo: toTodoResponse(todo) });
      },
      async DELETE({ context, params }) {
        const todoService = ServerBootstrap.getApplication().services.todos;
        await todoService.deleteTodo(context.webAuth.userId, params.todoId);
        return Http.ok();
      },
    },
  },
});
