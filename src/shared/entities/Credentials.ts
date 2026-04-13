import { v4 as uuidv4 } from "uuid";
import { CredentialType } from "~/shared/entities/enums/CredentialType";

export class Credential {
  id: string;
  idUser: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
  expirationDate?: Date;
  type: CredentialType;
  createdAt: Date;
  updatedAt: Date;

  constructor(expiresInSeconds?: number) {
    this.id = uuidv4();
    this.idUser = "";
    this.accessToken = "";
    this.refreshToken = "";
    this.type = CredentialType.Google;
    this.expiresInSeconds = expiresInSeconds;
    this.expirationDate =
      expiresInSeconds !== undefined
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  update(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds?: number,
  ): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.updatedAt = new Date();
    this.expiresInSeconds = expiresInSeconds;
    if (expiresInSeconds !== undefined) {
      this.expirationDate = new Date(Date.now() + expiresInSeconds * 1000);
    } else {
      this.expirationDate = undefined;
    }
  }

  toJSON() {
    return {
      id: this.id,
      idUser: this.idUser,
      type: this.type.toLowerCase(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
