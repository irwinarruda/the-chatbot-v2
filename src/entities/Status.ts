export interface DatabaseStatus {
  serverVersion: string;
  maxConnections: number;
  openConnections: number;
}

export interface AiStatus {
  modelName: string;
}

export class Status {
  updatedAt: Date;
  database: DatabaseStatus;
  ai: AiStatus;

  constructor(
    version: string,
    maxConnections: number,
    openConnections: number,
    modelName: string,
  ) {
    this.updatedAt = new Date();
    this.database = {
      serverVersion: version,
      maxConnections,
      openConnections,
    };
    this.ai = {
      modelName,
    };
  }
}
