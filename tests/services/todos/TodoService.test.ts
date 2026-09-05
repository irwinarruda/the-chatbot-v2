import { describe, expect, test } from "vitest";
import { Chat } from "~/modules/chat/entities/Chat";
import type { Message } from "~/modules/chat/entities/Message";
import { ChatHistoryService } from "~/modules/chat/services/ChatHistoryService";
import { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";
import { TodoService } from "~/modules/todos/services/TodoService";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/shared/gateway/DatabaseGateway";

interface TodoRow {
  id: string;
  id_user: string;
  id_source_message: string | null;
  name: string;
  description: string;
  due_date: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

class TodoDatabaseFake implements DatabaseGateway {
  readonly savedDueDates: Array<Date | null> = [];
  readonly sql: DatabaseGatewaySql;
  rows: TodoRow[];

  constructor(dueDate: Date) {
    const now = new Date("2026-07-14T12:00:00.000Z");
    this.rows = [
      {
        id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
        id_user: "498bf84a-b79d-45e3-9918-9804a04ebcc5",
        id_source_message: null,
        name: "Ship it",
        description: "",
        due_date: dueDate,
        status: TodoStatus.Pending,
        created_at: now,
        updated_at: now,
      },
    ];
    this.sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const statement = strings.join("?");
      if (statement.includes("SELECT")) return this.rows;
      if (statement.includes("UPDATE todos SET")) {
        const dueDate = values[3] as Date | null;
        this.savedDueDates.push(dueDate);
        this.rows[0] = {
          ...this.rows[0],
          id_source_message: values[0] as string | null,
          name: values[1] as string,
          description: values[2] as string,
          due_date: dueDate,
          status: values[4] as string,
          updated_at: values[5] as Date,
        };
        return { count: 1 };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    }) as unknown as DatabaseGatewaySql;
  }

  json(): never {
    throw new Error("JSON parameters are not used by this fake");
  }

  async transaction<T>(
    callback: (sql: DatabaseGatewaySql) => T | Promise<T>,
  ): Promise<T> {
    return callback(this.sql);
  }
}

class ChatHistoryFake extends ChatHistoryService {
  readonly requests: { idUser: string; ids: string[] }[] = [];
  messages: Message[] = [];

  override async getMessagesByIds(idUser: string, ids: string[]) {
    this.requests.push({ idUser, ids });
    return this.messages;
  }
}

describe("TodoService due-date updates", () => {
  test("omitting the due date preserves the stored value", async () => {
    const dueDate = new Date("2026-07-14T12:00:00.000Z");
    const database = new TodoDatabaseFake(dueDate);
    const service = new TodoService(database, new ChatHistoryFake(database));

    const todo = await service.updateTodo({
      id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
      idUser: "498bf84a-b79d-45e3-9918-9804a04ebcc5",
      status: TodoStatus.Completed,
    });

    expect(database.savedDueDates).toEqual([dueDate]);
    expect(todo.dueDate?.toISOString()).toBe("2026-07-14T12:00:00.000Z");
  });

  test("an explicit clear writes SQL null and returns no due date", async () => {
    const database = new TodoDatabaseFake(new Date("2026-07-14T12:00:00.000Z"));
    const service = new TodoService(database, new ChatHistoryFake(database));

    const todo = await service.updateTodo({
      id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
      idUser: "498bf84a-b79d-45e3-9918-9804a04ebcc5",
      dueDate: null,
    });

    expect(database.savedDueDates).toEqual([null]);
    expect(todo.dueDate).toBeUndefined();
  });
});

describe("TodoService source messages", () => {
  test("loads unique source messages as one user-scoped batch", async () => {
    const database = new TodoDatabaseFake(new Date("2026-07-14T12:00:00.000Z"));
    const history = new ChatHistoryFake(database);
    const service = new TodoService(database, history);
    const chat = new Chat();
    const firstMessage = chat.addUserTextMessage("Create the first task");
    const secondMessage = chat.addUserTextMessage("Create the second task");
    const row = database.rows[0];
    database.rows = [
      { ...row, id_source_message: firstMessage.id },
      { ...row, id: "second-todo", id_source_message: secondMessage.id },
      { ...row, id: "third-todo", id_source_message: firstMessage.id },
    ];
    history.messages = [secondMessage, firstMessage];

    const todos = await service.listTodos(row.id_user);

    expect(history.requests).toEqual([
      { idUser: row.id_user, ids: [firstMessage.id, secondMessage.id] },
    ]);
    expect(todos[0].sourceMessage).toBe(firstMessage);
    expect(todos[1].sourceMessage).toBe(secondMessage);
    expect(todos[2].sourceMessage).toBe(firstMessage);
  });

  test("hydrates a single todo through the chat history capability", async () => {
    const database = new TodoDatabaseFake(new Date("2026-07-14T12:00:00.000Z"));
    const history = new ChatHistoryFake(database);
    const service = new TodoService(database, history);
    const message = new Chat().addUserTextMessage("Create a task");
    const row = database.rows[0];
    row.id_source_message = message.id;
    history.messages = [message];

    const todo = await service.getTodoById(row.id_user, row.id);

    expect(todo.sourceMessage).toBe(message);
    expect(todo.toJSON().sourceMessage).toEqual(message.toJSON());
    expect(history.requests).toEqual([
      { idUser: row.id_user, ids: [message.id] },
    ]);
  });

  test("preserves a missing source reference without inventing a message", async () => {
    const database = new TodoDatabaseFake(new Date("2026-07-14T12:00:00.000Z"));
    const history = new ChatHistoryFake(database);
    const service = new TodoService(database, history);
    const row = database.rows[0];
    row.id_source_message = "missing-message";

    const todo = await service.getTodoById(row.id_user, row.id);

    expect(todo.idSourceMessage).toBe("missing-message");
    expect(todo.sourceMessage).toBeUndefined();
  });

  test("does not load chat history for todos without source references", async () => {
    const database = new TodoDatabaseFake(new Date("2026-07-14T12:00:00.000Z"));
    const history = new ChatHistoryFake(database);
    const service = new TodoService(database, history);

    const todos = await service.listTodos(database.rows[0].id_user);

    expect(todos).toHaveLength(1);
    expect(todos[0].sourceMessage).toBeUndefined();
    expect(history.requests).toEqual([]);
  });
});
