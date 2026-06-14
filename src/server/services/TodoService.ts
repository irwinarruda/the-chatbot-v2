import type { Database } from "~/infra/database";
import { NotFoundException, ValidationException } from "~/infra/exceptions";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";
import { Message } from "~/shared/entities/Message";
import { Todo } from "~/shared/entities/Todo";

export interface TodoFiltersDTO {
  search?: string;
  dueDate?: Date;
  due?: "all" | "with_due_date" | "without_due_date";
  status?: TodoStatus;
}

export interface CreateTodoDTO {
  idUser: string;
  idSourceMessage?: string;
  name: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
}

export interface UpdateTodoDTO {
  idUser: string;
  id: string;
  name?: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
}

export class TodoService {
  constructor(private database: Database) {}

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
    const todos: Todo[] = [];
    for (const dto of dtos) {
      todos.push(await this.createTodo(dto));
    }
    return todos;
  }

  async updateTodo(dto: UpdateTodoDTO): Promise<Todo> {
    const todo = await this.getTodoById(dto.idUser, dto.id);
    if (dto.name !== undefined) todo.rename(dto.name);
    if (dto.description !== undefined) todo.updateDescription(dto.description);
    if (dto.dueDate !== undefined) {
      todo.reschedule(dto.dueDate);
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
    const rows = await this.database.sql<DbTodoWithSourceMessage[]>`
      SELECT
        t.*,
        m.id AS source_message_id,
        m.id_chat AS source_message_chat_id,
        m.channel_message_id AS source_message_channel_message_id,
        m.type AS source_message_type,
        m.user_type AS source_message_user_type,
        m.text AS source_message_text,
        m.button_reply AS source_message_button_reply,
        m.button_reply_options AS source_message_button_reply_options,
        m.media_id AS source_message_media_id,
        m.media_url AS source_message_media_url,
        m.mime_type AS source_message_mime_type,
        m.transcript AS source_message_transcript,
        m.created_at AS source_message_created_at,
        m.updated_at AS source_message_updated_at
      FROM todos t
      LEFT JOIN messages m ON m.id = t.id_source_message
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
    return rows.map((row) => this.mapTodo(row));
  }

  private async get(idUser: string, id: string): Promise<Todo | undefined> {
    const rows = await this.database.sql<DbTodoWithSourceMessage[]>`
      SELECT
        t.*,
        m.id AS source_message_id,
        m.id_chat AS source_message_chat_id,
        m.channel_message_id AS source_message_channel_message_id,
        m.type AS source_message_type,
        m.user_type AS source_message_user_type,
        m.text AS source_message_text,
        m.button_reply AS source_message_button_reply,
        m.button_reply_options AS source_message_button_reply_options,
        m.media_id AS source_message_media_id,
        m.media_url AS source_message_media_url,
        m.mime_type AS source_message_mime_type,
        m.transcript AS source_message_transcript,
        m.created_at AS source_message_created_at,
        m.updated_at AS source_message_updated_at
      FROM todos t
      LEFT JOIN messages m ON m.id = t.id_source_message
      WHERE t.id_user = ${idUser}
      AND t.id = ${id}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return this.mapTodo(row);
  }

  private async create(todo: Todo): Promise<void> {
    await this.database.sql`
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

  private mapTodo(row: DbTodoWithSourceMessage): Todo {
    return new Todo({
      id: row.id,
      idUser: row.id_user,
      idSourceMessage: row.id_source_message ?? undefined,
      sourceMessage: this.mapSourceMessage(row),
      name: row.name,
      description: row.description,
      dueDate: row.due_date ?? undefined,
      status: row.status as TodoStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapSourceMessage(row: DbTodoWithSourceMessage): Message | undefined {
    if (!row.source_message_id) return undefined;
    const message = new Message();
    message.id = row.source_message_id;
    message.idChat = row.source_message_chat_id ?? "";
    message.channelMessageId =
      row.source_message_channel_message_id ?? undefined;
    message.type = (row.source_message_type as MessageType) ?? MessageType.Text;
    message.userType =
      (row.source_message_user_type as MessageUserType) ?? MessageUserType.User;
    message.text = row.source_message_text ?? undefined;
    message.buttonReply = row.source_message_button_reply ?? undefined;
    message.buttonReplyOptions =
      typeof row.source_message_button_reply_options === "string"
        ? row.source_message_button_reply_options.split(",")
        : undefined;
    message.mediaId = row.source_message_media_id ?? undefined;
    message.mediaUrl = row.source_message_media_url ?? undefined;
    message.mimeType = row.source_message_mime_type ?? undefined;
    message.transcript = row.source_message_transcript ?? undefined;
    message.createdAt = row.source_message_created_at ?? row.created_at;
    message.updatedAt = row.source_message_updated_at ?? row.updated_at;
    return message;
  }
}

interface DbTodo {
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

interface DbSourceMessage {
  source_message_id: string | null;
  source_message_chat_id: string | null;
  source_message_channel_message_id: string | null;
  source_message_type: string | null;
  source_message_user_type: string | null;
  source_message_text: string | null;
  source_message_button_reply: string | null;
  source_message_button_reply_options: string | null;
  source_message_media_id: string | null;
  source_message_media_url: string | null;
  source_message_mime_type: string | null;
  source_message_transcript: string | null;
  source_message_created_at: Date | null;
  source_message_updated_at: Date | null;
}

interface DbTodoWithSourceMessage extends DbTodo, DbSourceMessage {}
