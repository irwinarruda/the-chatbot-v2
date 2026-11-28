import { beforeEach, describe, expect, test } from "vitest";
import {
  JsonRpcErrorCode,
  McpToolCallResultDTO,
} from "~/contracts/http/mcp/json-rpc";
import type { User } from "~/domain/identity/user";
import { orquestrator } from "~/tests/support/orchestrator";

const publicOrigin = "https://chatbot.example";

function send(user: User, method: string, params?: Record<string, unknown>) {
  return orquestrator.mcpService.handleMessage(
    { jsonrpc: "2.0", id: 7, method, params },
    { idUser: user.id, publicOrigin },
  );
}

async function callTool(user: User, name: string, args: unknown) {
  const response = await send(user, "tools/call", { name, arguments: args });
  if (!response || !("result" in response)) {
    throw new Error(`Expected a tool result, got ${JSON.stringify(response)}`);
  }
  const result = McpToolCallResultDTO.parse(response.result);
  return { isError: result.isError, data: JSON.parse(result.content[0].text) };
}

function run(user: User, tool: string, operation: string, input = {}) {
  return callTool(user, tool, { operation, input });
}

describe("McpService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("negotiates the protocol and answers ping, notifications and unknown methods", async () => {
    const user = await orquestrator.createUser();

    expect(
      await send(user, "initialize", { protocolVersion: "2025-06-18" }),
    ).toMatchObject({
      id: 7,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "the-chatbot" },
      },
    });
    expect(
      await send(user, "initialize", { protocolVersion: "2099-01-01" }),
    ).toMatchObject({ result: { protocolVersion: "2025-11-25" } });
    expect(await send(user, "ping")).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: {},
    });
    expect(
      await orquestrator.mcpService.handleMessage(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { idUser: user.id, publicOrigin },
      ),
    ).toBeUndefined();
    expect(await send(user, "resources/list")).toMatchObject({
      error: { code: JsonRpcErrorCode.MethodNotFound },
    });
  });

  test("lists four router tools that expose only the external operations", async () => {
    const user = await orquestrator.createUser();

    const response = await send(user, "tools/list");
    const tools = (
      response && "result" in response ? response.result.tools : []
    ) as { name: string; description: string; annotations: object }[];
    const text = JSON.stringify(tools);

    expect(tools.map((tool) => tool.name)).toEqual([
      "chatbot_guide",
      "chatbot_read",
      "chatbot_write",
      "chatbot_destructive",
    ]);
    expect(tools[1].description).toContain("list_monthly_expenses");
    expect(tools[2].description).toContain("publish_artifact");
    expect(tools[3].description).toContain("delete_todo");
    expect(tools[3].annotations).toMatchObject({ destructiveHint: true });
    expect(text).not.toContain("reply_with_options");
    expect(text).not.toContain("delete_user_by_chat_channel_address");
  });

  test("guides a topic with each operation's tool and input schema", async () => {
    const user = await orquestrator.createUser();

    const guide = await callTool(user, "chatbot_guide", { topic: "todos" });
    const invalid = await callTool(user, "chatbot_guide", { topic: "chats" });

    expect(guide.isError).toBe(false);
    expect(guide.data.operations).toContainEqual(
      expect.objectContaining({
        operation: "update_todo",
        tool: "chatbot_write",
        inputSchema: expect.objectContaining({
          properties: expect.objectContaining({ todo_id: expect.anything() }),
        }),
      }),
    );
    expect(guide.data.operations).toContainEqual(
      expect.objectContaining({
        operation: "delete_todo",
        tool: "chatbot_destructive",
      }),
    );
    expect(invalid.isError).toBe(true);
  });

  test("creates, reads, completes and deletes todos through the matching tools", async () => {
    const user = await orquestrator.createUser();

    const created = await run(user, "chatbot_write", "create_todos", {
      todos: [{ name: "Pagar o aluguel", status: "Pending" }],
    });
    const todoId = created.data.todos[0].id;
    const completed = await run(user, "chatbot_write", "update_todo", {
      todo_id: todoId,
      status: "Completed",
    });
    const listed = await run(user, "chatbot_read", "list_todos", {
      status: "Completed",
    });
    const deleted = await run(user, "chatbot_destructive", "delete_todo", {
      todo_id: todoId,
    });

    expect(created.isError).toBe(false);
    expect(completed.data.todo.status).toBe("Completed");
    expect(listed.data).toMatchObject({ count: 1, todos: [{ id: todoId }] });
    expect(deleted).toEqual({
      isError: false,
      data: { message: "Todo deleted" },
    });
  });

  test("refuses an operation sent through a tool with another risk, or unknown", async () => {
    const user = await orquestrator.createUser();

    const wrongTool = await run(user, "chatbot_read", "create_todos", {
      todos: [{ name: "Nada", status: "Pending" }],
    });
    const unknown = await run(user, "chatbot_write", "send_whatsapp");
    const invalidInput = await run(user, "chatbot_read", "list_todos", {
      status: "Someday",
    });

    expect(wrongTool).toMatchObject({
      isError: true,
      data: { code: "WrongTool" },
    });
    expect(wrongTool.data.message).toContain("chatbot_write");
    expect(unknown).toMatchObject({
      isError: true,
      data: { code: "UnknownOperation" },
    });
    expect(invalidInput).toMatchObject({
      isError: true,
      data: { code: "InvalidArguments" },
    });
    expect(
      await orquestrator.todoService.listTodos(user.id, { status: "Pending" }),
    ).toHaveLength(0);
  });

  test("keeps each user's data apart", async () => {
    const owner = await orquestrator.createUser();
    const stranger = await orquestrator.createUser();
    const created = await run(owner, "chatbot_write", "create_note", {
      name: "Senha do wifi",
      markdown: "Só minha",
    });
    const noteId = created.data.note.id;

    const listed = await run(stranger, "chatbot_read", "list_notes");
    const read = await run(stranger, "chatbot_read", "read_note", {
      note_id: noteId,
    });
    const deleted = await run(stranger, "chatbot_destructive", "delete_note", {
      note_id: noteId,
    });

    expect(listed.data.count).toBe(0);
    expect(read).toMatchObject({
      isError: true,
      data: { code: "NotFoundException" },
    });
    expect(deleted.isError).toBe(true);
    expect(await orquestrator.noteService.listNotes(owner.id)).toHaveLength(1);
  });

  test("updates notes and publishes artifacts with their public link", async () => {
    const user = await orquestrator.createUser();
    const note = await run(user, "chatbot_write", "create_note", {
      name: "Ideias",
      markdown: "# Ideias",
    });
    const renamed = await run(user, "chatbot_write", "update_note", {
      note_id: note.data.note.id,
      name: "Ideias de viagem",
    });

    const published = await run(user, "chatbot_write", "publish_artifact", {
      title: "Resumo do mês",
      html: "<main><h1>Resumo</h1></main>",
    });
    const artifactId = published.data.artifact.id;
    const shared = await run(user, "chatbot_write", "set_artifact_visibility", {
      artifact_id: artifactId,
      visibility: "public",
    });
    const replaced = await run(user, "chatbot_write", "replace_artifact", {
      artifact_id: artifactId,
      title: "Resumo do mês",
      html: "<main><h1>Resumo corrigido</h1></main>",
    });
    const listed = await run(user, "chatbot_read", "list_artifacts");
    const deleted = await run(user, "chatbot_destructive", "delete_artifact", {
      artifact_id: artifactId,
    });

    expect(renamed.data.note.name).toBe("Ideias de viagem");
    expect(published.data.artifact).toMatchObject({
      title: "Resumo do mês",
      visibility: "private",
      url: `${publicOrigin}/a/${artifactId}`,
    });
    expect(shared.data.artifact.visibility).toBe("public");
    expect(replaced.data.artifact).toMatchObject({
      version: 2,
      visibility: "public",
    });
    expect(listed.data.count).toBe(1);
    expect(deleted.data).toEqual({ message: "Artifact deleted" });
  });

  test("manages monthly bills", async () => {
    const user = await orquestrator.createUser();

    const created = await run(user, "chatbot_write", "create_monthly_expense", {
      name: "Energia",
      expected_amount: 180,
      due_day: 12,
    });
    const listed = await run(user, "chatbot_read", "list_monthly_expenses", {});

    expect(created.isError).toBe(false);
    expect(JSON.stringify(listed.data)).toContain("Energia");
  });
});
