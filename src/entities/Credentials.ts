import { v4 as uuidv4 } from "uuid";

export const CredentialType = {
  Google: "google",
} as const;
export type CredentialType = ValueOf<typeof CredentialType>;

export class Credential {
  id: string;
  idUser: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number | undefined;
  expirationDate: Date | undefined;
  type: CredentialType;
  createdAt: Date;
  updatedAt: Date;

  constructor(expiresInSeconds?: number) {
    this.id = uuidv4();
    this.idUser = "";
    this.accessToken = "";
    this.refreshToken = "";
    this.type = CredentialType.Google;
    this.expiresInSeconds = expiresInSeconds ?? undefined;
    this.expirationDate =
      expiresInSeconds != null
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
    this.expiresInSeconds = expiresInSeconds ?? undefined;
    if (expiresInSeconds != null) {
      this.expirationDate = new Date(Date.now() + expiresInSeconds * 1000);
    }
  }
}
