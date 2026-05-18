import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/infra/exceptions";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";
import type { Message } from "~/shared/entities/Message";

export interface TodoConfig {
  id?: string;
  idUser: string;
  idSourceMessage?: string;
  sourceMessage?: Message;
  name: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Todo {
  id: string;
  idUser: string;
  idSourceMessage?: string;
  sourceMessage?: Message;
  name: string;
  description: string;
  dueDate?: Date;
  status: TodoStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: TodoConfig) {
    if (!config.idUser) {
      throw new ValidationException("Todo owner is required");
    }
    const name = config.name.trim();
    if (!name || name.length > 160) {
      throw new ValidationException(
        "Todo name must be present and have at most 160 characters",
      );
    }
    if (config.dueDate && Number.isNaN(config.dueDate.getTime())) {
      throw new ValidationException("Todo due date is invalid");
    }
    const status = config.status ?? TodoStatus.Pending;
    if (!Object.values(TodoStatus).includes(status)) {
      throw new ValidationException("Todo status is invalid");
    }
    this.id = config.id ?? uuidv4();
    this.idUser = config.idUser;
    this.idSourceMessage = config.idSourceMessage ?? config.sourceMessage?.id;
    this.sourceMessage = config.sourceMessage;
    this.name = name;
    this.description = config.description?.trim() ?? "";
    this.dueDate = config.dueDate;
    this.status = status;
    this.createdAt = config.createdAt ?? new Date();
    this.updatedAt = config.updatedAt ?? new Date();
  }

  rename(name: string): void {
    const nextName = name.trim();
    if (!nextName || nextName.length > 160) {
      throw new ValidationException(
        "Todo name must be present and have at most 160 characters",
      );
    }
    this.name = nextName;
    this.updatedAt = new Date();
  }

  updateDescription(description: string): void {
    this.description = description.trim();
    this.updatedAt = new Date();
  }

  reschedule(dueDate?: Date): void {
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      throw new ValidationException("Todo due date is invalid");
    }
    this.dueDate = dueDate;
    this.updatedAt = new Date();
  }

  updateStatus(status: TodoStatus): void {
    if (!Object.values(TodoStatus).includes(status)) {
      throw new ValidationException("Todo status is invalid");
    }
    this.status = status;
    this.updatedAt = new Date();
  }

  bindSourceMessage(idSourceMessage: string): void {
    if (!idSourceMessage) return;
    this.idSourceMessage = idSourceMessage;
    this.sourceMessage = undefined;
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      sourceMessage: this.sourceMessage?.toJSON(),
      name: this.name,
      description: this.description,
      dueDate: this.dueDate?.toISOString(),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
