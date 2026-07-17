import { describe, expect, test } from "vitest";
import { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";
import { TodoService } from "~/modules/todos/services/TodoService";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

interface TodoRow {
  id: string;
  id_user: string;
  id_source_message: null;
  name: string;
  description: string;
  due_date: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  source_message_id: null;
  source_message_chat_id: null;
  source_message_channel_message_id: null;
  source_message_turn_id: string;
  source_message_sequence: null;
  source_message_role: "user";
  source_message_audience: "all";
  source_message_content: null;
  source_message_created_at: null;
  source_message_updated_at: null;
}

class TodoDatabaseFake implements DatabaseGateway {
  readonly savedDueDates: Array<Date | null> = [];
  readonly sql: DatabaseGateway["sql"];
  private row: TodoRow;

  constructor(dueDate: Date) {
    const now = new Date("2026-07-14T12:00:00.000Z");
    this.row = {
      id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
      id_user: "498bf84a-b79d-45e3-9918-9804a04ebcc5",
      id_source_message: null,
      name: "Ship it",
      description: "",
      due_date: dueDate,
      status: TodoStatus.Pending,
      created_at: now,
      updated_at: now,
      source_message_id: null,
      source_message_chat_id: null,
      source_message_channel_message_id: null,
      source_message_turn_id: "",
      source_message_sequence: null,
      source_message_role: "user",
      source_message_audience: "all",
      source_message_content: null,
      source_message_created_at: null,
      source_message_updated_at: null,
    };
    this.sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const statement = strings.join("?");
      if (statement.includes("SELECT")) return [this.row];
      if (statement.includes("UPDATE todos SET")) {
        const dueDate = values[3] as Date | null;
        this.savedDueDates.push(dueDate);
        this.row = {
          ...this.row,
          id_source_message: values[0] as null,
          name: values[1] as string,
          description: values[2] as string,
          due_date: dueDate,
          status: values[4] as string,
          updated_at: values[5] as Date,
        };
        return { count: 1 };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    }) as unknown as DatabaseGateway["sql"];
  }

  json(): never {
    throw new Error("JSON parameters are not used by this fake");
  }

  async transaction<T>(
    callback: (sql: DatabaseGateway["sql"]) => T | Promise<T>,
  ): Promise<T> {
    return callback(this.sql);
  }
}

describe("TodoService due-date updates", () => {
  test("omitting the due date preserves the stored value", async () => {
    const dueDate = new Date("2026-07-14T12:00:00.000Z");
    const database = new TodoDatabaseFake(dueDate);
    const service = new TodoService(database);

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
    const service = new TodoService(database);

    const todo = await service.updateTodo({
      id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
      idUser: "498bf84a-b79d-45e3-9918-9804a04ebcc5",
      dueDate: null,
    });

    expect(database.savedDueDates).toEqual([null]);
    expect(todo.dueDate).toBeUndefined();
  });
});
