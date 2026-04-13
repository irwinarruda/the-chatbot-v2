import type { EncryptionConfig } from "@infra/config";
import type { Database } from "@infra/database";
import { Encryption } from "@infra/encryption";
import { UnauthorizedException, ValidationException } from "@infra/exceptions";
import { Credential } from "~/entities/Credentials";
import { CredentialType } from "~/entities/enums/CredentialType";
import { User } from "~/entities/User";
import type { IGoogleAuthGateway } from "~/resources/IGoogleAuthGateway";
import type { IMediator } from "~/utils/Mediator";

export type GoogleLoginResult =
  | { type: "redirect"; url: string }
  | { type: "alreadySignedIn" };

export type GoogleRedirectResult = { type: "success" };

export class AuthService {
  private database: Database;
  private encryptionConfig: EncryptionConfig;
  private googleAuthGateway: IGoogleAuthGateway;
  private mediator: IMediator;

  constructor(
    database: Database,
    encryptionConfig: EncryptionConfig,
    googleAuthGateway: IGoogleAuthGateway,
    mediator: IMediator,
  ) {
    this.database = database;
    this.encryptionConfig = encryptionConfig;
    this.googleAuthGateway = googleAuthGateway;
    this.mediator = mediator;
  }

  getAppLoginUrl(phoneNumber: string): string {
    return this.googleAuthGateway.getAppLoginUrl(phoneNumber);
  }

  getGoogleLoginUrl(phoneNumber: string): string {
    if (!phoneNumber) {
      throw new ValidationException("Phone number has no length");
    }
    const encryption = new Encryption(this.encryptionConfig);
    const state = encryption.encrypt(phoneNumber);
    return this.googleAuthGateway.createAuthorizationCodeUrl(state);
  }

  async saveUserByGoogleCredential(state: string, code: string): Promise<void> {
    const encryption = new Encryption(this.encryptionConfig);
    const phoneNumber = encryption.decrypt(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(code);
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    let user = await this.getUserByPhoneNumber(phoneNumber);
    if (user == null) {
      user = new User(userinfo.name, phoneNumber);
      user.email = userinfo.email;
      user.createGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.createUser(user);
      await this.mediator.send("SaveUserByGoogleCredential", user.phoneNumber);
      return;
    }
    if (user.googleCredential == null) {
      throw new ValidationException("Something went wrong with your request");
    }
    user.updateGoogleCredential(
      userToken.accessToken,
      userToken.refreshToken,
      userToken.expiresInSeconds,
    );
    if (!user.email && userinfo.email) {
      user.email = userinfo.email;
      await this.saveUserEmail(user);
    }
    await this.saveGoogleCredential(user.googleCredential);
    await this.mediator.send("SaveUserByGoogleCredential", user.phoneNumber);
  }

  async refreshGoogleCredential(user: User): Promise<void> {
    if (user.googleCredential == null) {
      throw new ValidationException(
        "Something went wrong refreshing user credentials.",
      );
    }
    const userToken = await this.googleAuthGateway.refreshToken(
      user.googleCredential.accessToken,
      user.googleCredential.refreshToken,
    );
    user.googleCredential.update(
      userToken.accessToken,
      userToken.refreshToken,
      userToken.expiresInSeconds,
    );
    await this.saveGoogleCredential(user.googleCredential);
  }

  async handleGoogleLogin(phoneNumber: string): Promise<GoogleLoginResult> {
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (user?.googleCredential != null) {
      await this.refreshGoogleCredential(user);
      return { type: "alreadySignedIn" };
    }
    const url = this.getGoogleLoginUrl(phoneNumber);
    return { type: "redirect", url };
  }

  async handleGoogleRedirect(
    state: string,
    code: string,
  ): Promise<GoogleRedirectResult> {
    await this.saveUserByGoogleCredential(state, code);
    return { type: "success" };
  }

  async createUser(user: User): Promise<User> {
    await this.database.sql`
      INSERT INTO users (id, name, phone_number, email, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${user.phoneNumber}, ${user.email}, ${user.createdAt}, ${user.updatedAt})
    `;
    if (user.googleCredential != null) {
      const credential = user.googleCredential;
      await this.database.sql`
        INSERT INTO google_credentials (id, id_user, access_token, refresh_token, expires_in_seconds, expiration_date, created_at, updated_at)
        VALUES (${credential.id}, ${user.id}, ${credential.accessToken}, ${credential.refreshToken}, ${credential.expiresInSeconds ?? null}, ${credential.expirationDate ?? null}, ${credential.createdAt}, ${credential.updatedAt})
      `;
    }
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE phone_number = ${phoneNumber}
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE id = ${id}
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser);
  }

  async deleteUserByPhoneNumber(phoneNumber: string): Promise<void> {
    await this.database
      .sql`DELETE FROM users WHERE phone_number = ${phoneNumber}`;
    await this.mediator.send("DeleteUserByPhoneNumber", phoneNumber);
  }

  private async saveGoogleCredential(
    googleCredential: Credential,
  ): Promise<void> {
    await this.database.sql`
      UPDATE google_credentials
      SET
        access_token = ${googleCredential.accessToken},
        refresh_token = ${googleCredential.refreshToken},
        expires_in_seconds = ${googleCredential.expiresInSeconds ?? null},
        expiration_date = ${googleCredential.expirationDate ?? null},
        updated_at = ${googleCredential.updatedAt}
      WHERE id = ${googleCredential.id}
    `;
  }

  async getUsers(): Promise<User[]> {
    const dbUsers = await this.database.sql<DbUser[]>`SELECT * FROM users`;
    const users: User[] = [];
    for (const dbUser of dbUsers) {
      const user = await this.hydrateUser(dbUser);
      users.push(user);
    }
    return users;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE email = ${email}
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser);
  }

  async handleWebGoogleRedirect(code: string): Promise<User> {
    const userToken =
      await this.googleAuthGateway.exchangeWebCodeForTokens(code);
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    const user = await this.getUserByEmail(userinfo.email);
    if (!user) {
      throw new UnauthorizedException(
        "User not registered",
        "You need to register via WhatsApp first.",
      );
    }
    if (!user.email) {
      user.email = userinfo.email;
      await this.saveUserEmail(user);
    }
    return user;
  }

  private async hydrateUser(dbUser: DbUser): Promise<User> {
    const user = new User();
    user.id = dbUser.id;
    user.name = dbUser.name;
    user.phoneNumber = dbUser.phone_number;
    user.email = dbUser.email ?? null;
    user.isInactive = dbUser.is_inactive;
    user.createdAt = dbUser.created_at;
    user.updatedAt = dbUser.updated_at;

    const dbCredentials = await this.database.sql<DbGoogleCredential[]>`
      SELECT * FROM google_credentials
      WHERE id_user = ${user.id}
    `;
    const dbCred = dbCredentials[0];
    if (dbCred) {
      const credential = new Credential();
      credential.id = dbCred.id;
      credential.idUser = dbCred.id_user;
      credential.accessToken = dbCred.access_token;
      credential.refreshToken = dbCred.refresh_token;
      credential.expiresInSeconds = dbCred.expires_in_seconds ?? undefined;
      credential.expirationDate = dbCred.expiration_date ?? undefined;
      credential.createdAt = dbCred.created_at;
      credential.updatedAt = dbCred.updated_at;
      credential.type = CredentialType.Google;
      user.googleCredential = credential;
    }
    return user;
  }

  private async saveUserEmail(user: User): Promise<void> {
    await this.database.sql`
      UPDATE users
      SET email = ${user.email}, updated_at = ${new Date()}
      WHERE id = ${user.id}
    `;
  }
}

interface DbUser {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  is_inactive: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbGoogleCredential {
  id: string;
  id_user: string;
  access_token: string;
  refresh_token: string;
  expires_in_seconds: number | null;
  expiration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}
