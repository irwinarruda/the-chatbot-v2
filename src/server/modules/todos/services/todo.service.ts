import type { Message } from "~/domain/chat/message";
import { ValidationException } from "~/domain/shared/domain-errors";
import { Todo } from "~/domain/todos/todo";
import type {
  CreateTodoDTO,
  TodoFiltersDTO,
  UpdateTodoDTO,
} from "~/domain/todos/todo-commands";
import { TodoStatus } from "~/domain/todos/todo-status";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import type {
  TodoRecord,
  TodoRepository,
} from "~/server/modules/todos/repositories/todo.repository";
import { NotFoundException } from "~/server/shared/errors/application-errors";

export class TodoService {
  constructor(
    private todos: TodoRepository,
    private chats: ChatRepository,
  ) {}

  async listTodos(
    idUser: string,
    filters: TodoFiltersDTO = {},
  ): Promise<Todo[]> {
    this.validateFilters(filters);
    return this.restoreTodos(idUser, await this.todos.list(idUser, filters));
  }

  async getTodoById(idUser: string, id: string): Promise<Todo> {
    const record = await this.todos.get(idUser, id);
    if (!record) throw new NotFoundException("Todo not found");
    const [todo] = await this.restoreTodos(idUser, [record]);
    return todo;
  }

  async createTodo(dto: CreateTodoDTO): Promise<Todo> {
    const todo = new Todo(dto);
    await this.todos.create(todo);
    return this.getTodoById(todo.idUser, todo.id);
  }

  async createTodos(dtos: CreateTodoDTO[]): Promise<Todo[]> {
    const todos = dtos.map((dto) => new Todo(dto));
    await this.todos.createMany(todos);
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
    await this.todos.save(todo);
    return this.getTodoById(todo.idUser, todo.id);
  }

  async deleteTodo(idUser: string, id: string): Promise<void> {
    const isDeleted = await this.todos.delete(idUser, id);
    if (!isDeleted) throw new NotFoundException("Todo not found");
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

  private async restoreTodos(
    idUser: string,
    records: TodoRecord[],
  ): Promise<Todo[]> {
    const sourceMessageIds = [
      ...new Set(
        records
          .map((record) => record.idSourceMessage)
          .filter((id) => id !== undefined),
      ),
    ];
    let sourceMessages: Message[] = [];
    if (sourceMessageIds.length > 0) {
      sourceMessages = await this.chats.getMessagesByIds(
        idUser,
        sourceMessageIds,
      );
    }
    const messagesById = new Map(
      sourceMessages.map((message) => [message.id, message]),
    );
    return records.map((record) =>
      Todo.restore({
        ...record,
        sourceMessage: messagesById.get(record.idSourceMessage ?? ""),
      }),
    );
  }
}
