import type { EncryptionConfig, JwtConfig } from "~/infra/config";
import type { Database } from "~/infra/database";
import { Encryption } from "~/infra/encryption";
import {
  DeveloperException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from "~/infra/exceptions";
import { Jwt } from "~/infra/jwt";
import type { IMediator } from "~/infra/Mediator";
import type {
  GoogleTokens,
  GoogleUserInfo,
  IGoogleAuthGateway,
} from "~/server/resources/IGoogleAuthGateway";
import { Credential } from "~/shared/entities/Credentials";
import { CredentialType } from "~/shared/entities/enums/CredentialType";
import { User } from "~/shared/entities/User";

export interface WebAuthTokenPayload {
  userId: string;
  email: string;
  phoneNumber: string;
}

export type GoogleLoginResult =
  | { type: "redirect"; url: string }
  | { type: "alreadySignedIn" };

export type WebGoogleLoginResult =
  | { type: "redirect"; url: string }
  | { type: "alreadySignedIn"; token: string }
  | { type: "notRegistered" };

export type GoogleRedirectResult = { type: "success" };

export type WebGoogleRedirectResult = string;

type GoogleAuthTarget = "app" | "web";

export class AuthService {
  private database: Database;
  private encryptionConfig: EncryptionConfig;
  private jwtConfig: JwtConfig;
  private googleAuthGateway: IGoogleAuthGateway;
  private mediator: IMediator;

  constructor(
    database: Database,
    encryptionConfig: EncryptionConfig,
    jwtConfig: JwtConfig,
    googleAuthGateway: IGoogleAuthGateway,
    mediator: IMediator,
  ) {
    this.database = database;
    this.encryptionConfig = encryptionConfig;
    this.jwtConfig = jwtConfig;
    this.googleAuthGateway = googleAuthGateway;
    this.mediator = mediator;
  }

  getAppLoginUrl(phoneNumber: string): string {
    return this.googleAuthGateway.getAppLoginUrl(phoneNumber);
  }

  async handleGoogleLogin(phoneNumber: string): Promise<GoogleLoginResult> {
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (user?.googleCredential) {
      await this.refreshGoogleCredential(user);
      return { type: "alreadySignedIn" };
    }
    const state = this.encryptPhoneNumber(phoneNumber);
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(state);
    return { type: "redirect", url };
  }

  async handleGoogleRedirect(
    state: string,
    code: string,
  ): Promise<GoogleRedirectResult> {
    const phoneNumber = this.decryptPhoneNumber(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(code);
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    await this.saveUserFromGoogleAuth(phoneNumber, userToken, userinfo, "app");
    return { type: "success" };
  }

  async handleWebGoogleLogin(
    phoneNumber: string,
  ): Promise<WebGoogleLoginResult> {
    if (!phoneNumber) {
      throw new ValidationException("Phone number has no length");
    }
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return { type: "notRegistered" };
    }
    if (user?.googleCredential) {
      await this.refreshGoogleCredential(user);
      const token = await this.createWebToken(user);
      return { type: "alreadySignedIn", token };
    }
    const state = this.encryptPhoneNumber(phoneNumber);
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(state, "web");
    return { type: "redirect", url };
  }

  async handleWebGoogleRedirect(
    state: string,
    code: string,
  ): Promise<WebGoogleRedirectResult> {
    const phoneNumber = this.decryptPhoneNumber(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(code);
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    const user = await this.saveUserFromGoogleAuth(
      phoneNumber,
      userToken,
      userinfo,
      "web",
    );
    return this.createWebToken(user);
  }

  async refreshGoogleCredential(user: User): Promise<void> {
    if (!user.googleCredential) {
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

  async authenticateWebUser(token: string): Promise<User> {
    if (!token) {
      throw new UnauthorizedException(
        "Authentication required",
        "Please log in to continue.",
      );
    }
    const jwt = new Jwt(this.jwtConfig);
    let payload: WebAuthTokenPayload;
    try {
      payload = await jwt.verify<WebAuthTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired authentication token",
        "Please log in again.",
      );
    }
    if (!payload.userId || !payload.email || !payload.phoneNumber) {
      throw new UnauthorizedException(
        "Invalid authentication token",
        "Please log in again.",
      );
    }
    const user = await this.getUserById(payload.userId);
    if (!user || user.email !== payload.email) {
      throw new UnauthorizedException(
        "Invalid authentication token",
        "Please log in again.",
      );
    }
    return user;
  }

  async createWebToken(user: User): Promise<string> {
    const jwt = new Jwt(this.jwtConfig);
    return jwt.sign({
      userId: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });
  }

  private encryptPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) {
      throw new ValidationException("Phone number has no length");
    }
    const encryption = new Encryption(this.encryptionConfig);
    return encryption.encrypt(phoneNumber);
  }

  private decryptPhoneNumber(state: string): string {
    if (!state) {
      throw new ValidationException("Phone number has no length");
    }
    const encryption = new Encryption(this.encryptionConfig);
    return encryption.decrypt(state);
  }

  private async saveUserFromGoogleAuth(
    phoneNumber: string,
    userToken: GoogleTokens,
    userinfo: GoogleUserInfo,
    target: GoogleAuthTarget = "app",
  ): Promise<User> {
    let user = await this.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      if (target === "web") {
        throw new NotFoundException(
          "User not found",
          "Register this phone number in the app before signing in on the web.",
        );
      }
      user = new User(userinfo.name, phoneNumber, userinfo.email);
      user.createGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.createUser(user);
      await this.mediator.send("SaveUserByGoogleCredential", user.phoneNumber);
      return user;
    }
    if (user.email && user.email !== userinfo.email) {
      throw new UnauthorizedException(
        "The logged in Google account does not match this phone number.",
        "Log in with the correct Google account and try again.",
      );
    }
    if (!user.googleCredential) {
      user.createGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      if (!user.googleCredential) {
        throw new DeveloperException(
          "createGoogleCredential must always create a google credential",
        );
      }
      await this.createGoogleCredential(user.googleCredential);
    } else {
      user.updateGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.saveGoogleCredential(user.googleCredential);
    }
    if (userinfo.email && !user.email) {
      user.updateEmail(userinfo.email);
      await this.saveUser(user);
    }
    return user;
  }

  async createUser(user: User): Promise<User> {
    const email = user.email ?? null;
    await this.database.sql`
      INSERT INTO users (id, name, phone_number, email, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${user.phoneNumber}, ${email}, ${user.createdAt}, ${user.updatedAt})
    `;
    if (user.googleCredential) {
      const credential = user.googleCredential;
      const expiresInSeconds = credential.expiresInSeconds ?? null;
      const expirationDate = credential.expirationDate ?? null;
      await this.database.sql`
        INSERT INTO google_credentials (id, id_user, access_token, refresh_token, expires_in_seconds, expiration_date, created_at, updated_at)
        VALUES (${credential.id}, ${user.id}, ${credential.accessToken}, ${credential.refreshToken}, ${expiresInSeconds}, ${expirationDate}, ${credential.createdAt}, ${credential.updatedAt})
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

  async deleteUserByPhoneNumber(phoneNumber: string): Promise<void> {
    await this.database
      .sql`DELETE FROM users WHERE phone_number = ${phoneNumber}`;
    await this.mediator.send("DeleteUserByPhoneNumber", phoneNumber);
  }

  private async saveGoogleCredential(
    googleCredential: Credential,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    await this.database.sql`
      UPDATE google_credentials
      SET
        access_token = ${googleCredential.accessToken},
        refresh_token = ${googleCredential.refreshToken},
        expires_in_seconds = ${expiresInSeconds},
        expiration_date = ${expirationDate},
        updated_at = ${googleCredential.updatedAt}
      WHERE id = ${googleCredential.id}
    `;
  }

  private async createGoogleCredential(
    googleCredential: Credential,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    await this.database.sql`
      INSERT INTO google_credentials (id, id_user, access_token, refresh_token, expires_in_seconds, expiration_date, created_at, updated_at)
      VALUES (${googleCredential.id}, ${googleCredential.idUser}, ${googleCredential.accessToken}, ${googleCredential.refreshToken}, ${expiresInSeconds}, ${expirationDate}, ${googleCredential.createdAt}, ${googleCredential.updatedAt})
    `;
  }

  private async hydrateUser(dbUser: DbUser): Promise<User> {
    const user = new User();
    user.id = dbUser.id;
    user.name = dbUser.name;
    user.phoneNumber = dbUser.phone_number;
    user.email = dbUser.email ?? undefined;
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

  private async saveUser(user: User): Promise<void> {
    const email = user.email ?? null;
    await this.database.sql`
      UPDATE users
      SET
        name = ${user.name},
        email = ${email},
        phone_number = ${user.phoneNumber},
        is_inactive = ${user.isInactive},
        updated_at = ${user.updatedAt}
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
