import { v4 as uuidv4 } from "uuid";
import type { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface ArtifactConfig {
  id?: string;
  idUser: string;
  title: string;
  visibility: ArtifactVisibility;
  sourceHtml: string;
  renderedHtml: string;
  rendererVersion: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RestoredArtifactConfig extends ArtifactConfig {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Artifact {
  id: string;
  idUser: string;
  title: string;
  visibility: ArtifactVisibility;
  sourceHtml: string;
  renderedHtml: string;
  rendererVersion: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: ArtifactConfig) {
    if (!config.idUser) {
      throw new ValidationException("Artifact owner is required");
    }
    const title = config.title.trim();
    if (!title || title.length > 160) {
      throw new ValidationException(
        "Artifact title must be present and have at most 160 characters",
      );
    }
    assertArtifactHtml(config.sourceHtml, config.renderedHtml);
    this.id = config.id ?? uuidv4();
    this.idUser = config.idUser;
    this.title = title;
    this.visibility = config.visibility;
    this.sourceHtml = config.sourceHtml;
    this.renderedHtml = config.renderedHtml;
    this.rendererVersion = config.rendererVersion;
    this.version = config.version ?? 1;
    this.createdAt = config.createdAt ?? new Date();
    this.updatedAt = config.updatedAt ?? new Date();
  }

  static restore(config: RestoredArtifactConfig): Artifact {
    return new Artifact(config);
  }

  replace(config: {
    title: string;
    visibility: ArtifactVisibility;
    sourceHtml: string;
    renderedHtml: string;
    rendererVersion: string;
  }): void {
    const title = config.title.trim();
    if (!title || title.length > 160) {
      throw new ValidationException(
        "Artifact title must be present and have at most 160 characters",
      );
    }
    assertArtifactHtml(config.sourceHtml, config.renderedHtml);
    this.title = title;
    this.visibility = config.visibility;
    this.sourceHtml = config.sourceHtml;
    this.renderedHtml = config.renderedHtml;
    this.rendererVersion = config.rendererVersion;
    this.version += 1;
    this.updatedAt = new Date();
  }

  changeVisibility(visibility: ArtifactVisibility): void {
    this.visibility = visibility;
    this.updatedAt = new Date();
  }
}

function assertArtifactHtml(sourceHtml: string, renderedHtml: string): void {
  if (!sourceHtml.trim()) {
    throw new ValidationException("Artifact HTML is required");
  }
  if (!renderedHtml.trim()) {
    throw new ValidationException("Rendered artifact HTML is required");
  }
}
