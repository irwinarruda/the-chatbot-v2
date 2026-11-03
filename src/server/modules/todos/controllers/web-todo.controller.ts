import { createFileRoute } from "@tanstack/react-router";
import { SaveTodoRequestDTO } from "~/contracts/http/todos/todo";
import {
  toTodoDueDate,
  toTodoResponse,
} from "~/contracts/http/todos/todo-mapper";
import type { UpdateTodoDTO } from "~/domain/todos/todo-commands";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/todos/$todoId")({
  server: {
    handlers: {
      async GET({ context, params }) {
        const todoService = getServer().services.todos;
        const todo = await todoService.getTodoById(
          context.webAuth.userId,
          params.todoId,
        );
        return Http.json({ todo: toTodoResponse(todo) });
      },
      async PATCH({ request, context, params }) {
        const todoService = getServer().services.todos;
        const body = SaveTodoRequestDTO.parse(await parseJsonRequest(request));
        const patch: UpdateTodoDTO = {
          idUser: context.webAuth.userId,
          id: params.todoId,
          name: body.name,
          description: body.description,
          status: body.status,
        };
        if ("dueDate" in body) {
          patch.dueDate = body.dueDate ? toTodoDueDate(body.dueDate) : null;
        }
        const todo = await todoService.updateTodo(patch);
        return Http.json({ todo: toTodoResponse(todo) });
      },
      async DELETE({ context, params }) {
        const todoService = getServer().services.todos;
        await todoService.deleteTodo(context.webAuth.userId, params.todoId);
        return Http.ok();
      },
    },
  },
});
