import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface NoteConfig {
  id?: string;
  idUser: string;
  idSourceMessage?: string;
  name: string;
  markdown?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RestoredNoteConfig {
  id: string;
  idUser: string;
  idSourceMessage?: string;
  name: string;
  markdown: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Note {
  id: string;
  idUser: string;
  idSourceMessage?: string;
  name: string;
  markdown: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: NoteConfig) {
    if (!config.idUser) {
      throw new ValidationException("Note owner is required");
    }
    const name = config.name.trim();
    if (!name || name.length > 160) {
      throw new ValidationException(
        "Note name must be present and have at most 160 characters",
      );
    }
    this.id = config.id ?? uuidv4();
    this.idUser = config.idUser;
    this.idSourceMessage = config.idSourceMessage;
    this.name = name;
    this.markdown = config.markdown ?? "";
    this.createdAt = config.createdAt ?? new Date();
    this.updatedAt = config.updatedAt ?? new Date();
  }

  static restore(config: RestoredNoteConfig): Note {
    return new Note(config);
  }

  rename(name: string): void {
    const nextName = name.trim();
    if (!nextName || nextName.length > 160) {
      throw new ValidationException(
        "Note name must be present and have at most 160 characters",
      );
    }
    this.name = nextName;
    this.updatedAt = new Date();
  }

  replaceMarkdown(markdown: string): void {
    this.markdown = markdown;
    this.updatedAt = new Date();
  }

  appendMarkdown(markdown: string): void {
    if (!markdown.trim()) {
      throw new ValidationException("Note addition is required");
    }
    if (!this.markdown.trim()) {
      this.markdown = markdown;
    } else {
      this.markdown = `${this.markdown}\n\n${markdown}`;
    }
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      markdown: this.markdown,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
