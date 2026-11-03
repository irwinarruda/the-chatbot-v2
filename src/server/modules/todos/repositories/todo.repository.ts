import type { RestoredTodoConfig, Todo } from "~/domain/todos/todo";
import type { TodoFiltersDTO } from "~/domain/todos/todo-commands";
import { TodoStatus } from "~/domain/todos/todo-status";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/server/shared/database/database";

export type TodoRecord = Omit<RestoredTodoConfig, "sourceMessage">;

export class TodoRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async list(idUser: string, filters: TodoFiltersDTO): Promise<TodoRecord[]> {
    const rows = await this.database.sql<DbTodo[]>`
      SELECT t.*
      FROM todos t
      WHERE t.id_user = ${idUser}
      AND (${filters.search?.trim() ?? null}::text IS NULL OR (
        t.name ILIKE ${filters.search?.trim() ? `%${filters.search.trim()}%` : null}
        OR t.description ILIKE ${filters.search?.trim() ? `%${filters.search.trim()}%` : null}
      ))
      AND (${filters.status ?? null}::text IS NULL OR t.status = ${filters.status ?? null})
      AND (${filters.due ?? "all"}::text != 'with_due_date' OR t.due_date IS NOT NULL)
      AND (${filters.due ?? "all"}::text != 'without_due_date' OR t.due_date IS NULL)
      AND (${startOfDay(filters.dueDate)}::timestamptz IS NULL OR (
        t.due_date >= ${startOfDay(filters.dueDate)}
        AND t.due_date < ${endOfDay(filters.dueDate)}
      ))
      ORDER BY
        CASE WHEN t.status = ${TodoStatus.Pending} THEN 0 ELSE 1 END,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
    `;
    return rows.map(toTodoRecord);
  }

  async get(idUser: string, id: string): Promise<TodoRecord | undefined> {
    const rows = await this.database.sql<DbTodo[]>`
      SELECT t.*
      FROM todos t
      WHERE t.id_user = ${idUser}
      AND t.id = ${id}
    `;
    return rows.map(toTodoRecord)[0];
  }

  async create(todo: Todo): Promise<void> {
    await insertTodo(this.database.sql, todo);
  }

  async createMany(todos: Todo[]): Promise<void> {
    await this.database.transaction(async (sql) => {
      for (const todo of todos) await insertTodo(sql, todo);
    });
  }

  async save(todo: Todo): Promise<void> {
    await this.database.sql`
      UPDATE todos SET
        id_source_message = ${todo.idSourceMessage ?? null},
        name = ${todo.name},
        description = ${todo.description},
        due_date = ${todo.dueDate ?? null},
        status = ${todo.status},
        updated_at = ${todo.updatedAt}
      WHERE id_user = ${todo.idUser}
      AND id = ${todo.id}
    `;
  }

  async delete(idUser: string, id: string): Promise<boolean> {
    const result = await this.database.sql`
      DELETE FROM todos
      WHERE id_user = ${idUser}
      AND id = ${id}
    `;
    return result.count > 0;
  }
}

async function insertTodo(sql: DatabaseGatewaySql, todo: Todo): Promise<void> {
  await sql`
      INSERT INTO todos (
        id,
        id_user,
        id_source_message,
        name,
        description,
        due_date,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${todo.id},
        ${todo.idUser},
        ${todo.idSourceMessage ?? null},
        ${todo.name},
        ${todo.description},
        ${todo.dueDate ?? null},
        ${todo.status},
        ${todo.createdAt},
        ${todo.updatedAt}
      )
    `;
}

function startOfDay(date?: Date): Date | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfDay(date?: Date): Date | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

function toTodoRecord(row: DbTodo): TodoRecord {
  return {
    id: row.id,
    idUser: row.id_user,
    idSourceMessage: row.id_source_message ?? undefined,
    name: row.name,
    description: row.description,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface DbTodo {
  id: string;
  id_user: string;
  id_source_message: string | null;
  name: string;
  description: string;
  due_date: Date | null;
  status: TodoStatus;
  created_at: Date;
  updated_at: Date;
}
