import type { Message } from "~/modules/chat/entities/Message";
import type { ChatHistoryService } from "~/modules/chat/services/ChatHistoryService";
import type {
  CreateTodoDTO,
  TodoFiltersDTO,
  UpdateTodoDTO,
} from "~/modules/todos/entities/dtos/TodoServiceDTO";
import { TodoStatus } from "~/modules/todos/entities/enums/TodoStatus";
import { Todo } from "~/modules/todos/entities/Todo";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/shared/gateway/DatabaseGateway";

export class TodoService {
  constructor(
    private database: DatabaseGateway,
    private chatHistory: ChatHistoryService,
  ) {}

  async listTodos(
    idUser: string,
    filters: TodoFiltersDTO = {},
  ): Promise<Todo[]> {
    this.validateFilters(filters);
    return this.list(idUser, filters);
  }

  async getTodoById(idUser: string, id: string): Promise<Todo> {
    const todo = await this.get(idUser, id);
    if (!todo) throw new NotFoundException("Todo not found");
    return todo;
  }

  async createTodo(dto: CreateTodoDTO): Promise<Todo> {
    const todo = new Todo(dto);
    await this.create(todo);
    return this.getTodoById(todo.idUser, todo.id);
  }

  async createTodos(dtos: CreateTodoDTO[]): Promise<Todo[]> {
    const todos = dtos.map((dto) => new Todo(dto));
    await this.database.transaction(async (sql) => {
      for (const todo of todos) await this.create(todo, sql);
    });
    return Promise.all(
      todos.map((todo) => this.getTodoById(todo.idUser, todo.id)),
    );
  }

  async updateTodo(dto: UpdateTodoDTO): Promise<Todo> {
    const todo = await this.getTodoById(dto.idUser, dto.id);
    if (dto.name !== undefined) todo.rename(dto.name);
    if (dto.description !== undefined) todo.updateDescription(dto.description);
    if (dto.dueDate !== undefined) {
      todo.reschedule(dto.dueDate ?? undefined);
    }
    if (dto.status !== undefined) todo.updateStatus(dto.status);
    await this.save(todo);
    return this.getTodoById(todo.idUser, todo.id);
  }

  async deleteTodo(idUser: string, id: string): Promise<void> {
    const deleted = await this.remove(idUser, id);
    if (!deleted) throw new NotFoundException("Todo not found");
  }

  private async list(idUser: string, filters: TodoFiltersDTO): Promise<Todo[]> {
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
      AND (${this.startOfDay(filters.dueDate)}::timestamptz IS NULL OR (
        t.due_date >= ${this.startOfDay(filters.dueDate)}
        AND t.due_date < ${this.endOfDay(filters.dueDate)}
      ))
      ORDER BY
        CASE WHEN t.status = ${TodoStatus.Pending} THEN 0 ELSE 1 END,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
    `;
    return this.restoreTodos(idUser, rows);
  }

  private async get(idUser: string, id: string): Promise<Todo | undefined> {
    const rows = await this.database.sql<DbTodo[]>`
      SELECT t.*
      FROM todos t
      WHERE t.id_user = ${idUser}
      AND t.id = ${id}
    `;
    const todos = await this.restoreTodos(idUser, rows);
    return todos[0];
  }

  private async create(
    todo: Todo,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
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

  private async save(todo: Todo): Promise<void> {
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

  private async remove(idUser: string, id: string): Promise<boolean> {
    const result = await this.database.sql`
      DELETE FROM todos
      WHERE id_user = ${idUser}
      AND id = ${id}
    `;
    return result.count > 0;
  }

  private validateFilters(filters: TodoFiltersDTO): void {
    if (filters.status && !Object.values(TodoStatus).includes(filters.status)) {
      throw new ValidationException("Todo status is invalid");
    }
    if (
      filters.due &&
      !["all", "with_due_date", "without_due_date"].includes(filters.due)
    ) {
      throw new ValidationException("Todo due filter is invalid");
    }
    if (filters.dueDate && Number.isNaN(filters.dueDate.getTime())) {
      throw new ValidationException("Todo due date filter is invalid");
    }
  }

  private startOfDay(date?: Date): Date | null {
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private endOfDay(date?: Date): Date | null {
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      ),
    );
  }

  private async restoreTodos(idUser: string, rows: DbTodo[]): Promise<Todo[]> {
    const sourceMessageIds = [
      ...new Set(
        rows.map((row) => row.id_source_message).filter((id) => id !== null),
      ),
    ];
    let sourceMessages: Message[] = [];
    if (sourceMessageIds.length > 0) {
      sourceMessages = await this.chatHistory.getMessagesByIds(
        idUser,
        sourceMessageIds,
      );
    }
    const messagesById = new Map(
      sourceMessages.map((message) => [message.id, message]),
    );
    return rows.map((row) =>
      Todo.restore({
        id: row.id,
        idUser: row.id_user,
        idSourceMessage: row.id_source_message ?? undefined,
        sourceMessage: messagesById.get(row.id_source_message ?? ""),
        name: row.name,
        description: row.description,
        dueDate: row.due_date ?? undefined,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }
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
