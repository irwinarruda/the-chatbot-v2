import { NotFoundException, ValidationException } from "~/infra/exceptions";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";
import { orquestrator } from "./orquestrator";

describe("TodoService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("creates one todo and multiple todos", async () => {
    const user = await orquestrator.createUser();
    const todo = await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Buy milk",
      description: "Whole milk",
      dueDate: new Date("2026-05-18T12:00:00.000Z"),
    });
    expect(todo.name).toBe("Buy milk");
    expect(todo.description).toBe("Whole milk");
    expect(todo.status).toBe(TodoStatus.Pending);
    expect(todo.dueDate?.toISOString()).toBe("2026-05-18T12:00:00.000Z");

    const todos = await orquestrator.todoService.createTodos([
      { idUser: user.id, name: "Call Ana" },
      {
        idUser: user.id,
        name: "Ship report",
        status: TodoStatus.Completed,
      },
    ]);
    expect(todos).toHaveLength(2);
    expect(todos.map((item) => item.name)).toEqual(["Call Ana", "Ship report"]);
  });

  test("lists todos scoped by user and filters by search, due date, due, and status", async () => {
    const user = await orquestrator.createUser();
    const otherUser = await orquestrator.createUser();
    await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Buy milk",
      dueDate: new Date("2026-05-17T15:00:00.000Z"),
    });
    await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Call Ana",
      description: "Discuss launch",
    });
    await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Archive invoices",
      status: TodoStatus.Completed,
    });
    await orquestrator.todoService.createTodo({
      idUser: otherUser.id,
      name: "Other user task",
    });

    const all = await orquestrator.todoService.listTodos(user.id);
    expect(all).toHaveLength(3);
    expect(all.some((todo) => todo.name === "Other user task")).toBe(false);

    const searched = await orquestrator.todoService.listTodos(user.id, {
      search: "launch",
    });
    expect(searched.map((todo) => todo.name)).toEqual(["Call Ana"]);

    const dueOnDay = await orquestrator.todoService.listTodos(user.id, {
      dueDate: new Date("2026-05-17T00:00:00.000Z"),
    });
    expect(dueOnDay.map((todo) => todo.name)).toEqual(["Buy milk"]);

    const withoutDueDate = await orquestrator.todoService.listTodos(user.id, {
      due: "without_due_date",
    });
    expect(withoutDueDate.map((todo) => todo.name)).toEqual([
      "Call Ana",
      "Archive invoices",
    ]);

    const completed = await orquestrator.todoService.listTodos(user.id, {
      status: TodoStatus.Completed,
    });
    expect(completed.map((todo) => todo.name)).toEqual(["Archive invoices"]);
  });

  test("updates fields and deletes todos", async () => {
    const user = await orquestrator.createUser();
    const todo = await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Draft",
    });
    const updated = await orquestrator.todoService.updateTodo({
      idUser: user.id,
      id: todo.id,
      name: "Final draft",
      description: "Ready to send",
      dueDate: new Date("2026-05-19T12:00:00.000Z"),
      status: TodoStatus.Completed,
    });
    expect(updated).toMatchObject({
      id: todo.id,
      name: "Final draft",
      description: "Ready to send",
      status: TodoStatus.Completed,
    });
    expect(updated.dueDate?.toISOString()).toBe("2026-05-19T12:00:00.000Z");

    await orquestrator.todoService.deleteTodo(user.id, todo.id);
    await expect(
      orquestrator.todoService.getTodoById(user.id, todo.id),
    ).rejects.toThrow(NotFoundException);
  });

  test("hydrates source message and serializes through todo entity", async () => {
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      audioBuffer: Buffer.from("audio-content"),
      mimeType: "audio/mp4; codecs=mp4a.40.2",
    });

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    const sourceMessage = chat?.messages[0];
    expect(sourceMessage).toBeDefined();

    const todo = await orquestrator.todoService.createTodo({
      idUser: user.id,
      idSourceMessage: sourceMessage?.id,
      name: "Review transcript",
    });

    expect(todo.sourceMessage?.id).toBe(sourceMessage?.id);
    expect(todo.sourceMessage?.type).toBe(sourceMessage?.type);
    expect(todo.sourceMessage?.transcript).toBe(sourceMessage?.transcript);
    expect(todo.toJSON()).toMatchObject({
      id: todo.id,
      name: "Review transcript",
      sourceMessage: {
        id: sourceMessage?.id,
        type: "audio",
        transcript: sourceMessage?.transcript,
      },
    });
  });

  test("rejects unsupported status and access to another user's todo", async () => {
    const user = await orquestrator.createUser();
    const otherUser = await orquestrator.createUser();
    const todo = await orquestrator.todoService.createTodo({
      idUser: user.id,
      name: "Private task",
    });

    await expect(
      orquestrator.todoService.getTodoById(otherUser.id, todo.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      orquestrator.todoService.createTodo({
        idUser: user.id,
        name: "Bad status",
        status: "Archived" as TodoStatus,
      }),
    ).rejects.toThrow(ValidationException);
  });
});
