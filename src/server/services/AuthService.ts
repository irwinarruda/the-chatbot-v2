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
import type { IMediator } from "~/infra/mediator";
import type {
  GoogleTokens,
  GoogleUserInfo,
  IGoogleAuthGateway,
} from "~/server/resources/IGoogleAuthGateway";
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import { Credential } from "~/shared/entities/Credentials";
import { CredentialType } from "~/shared/entities/enums/CredentialType";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";
import { User } from "~/shared/entities/User";

export interface WebAuthTokenPayload {
  userId: string;
  email: string;
  phoneNumber?: string;
}

export interface SyncUserChatAddressesEvent {
  idUser: string;
  email?: string;
  phoneNumber?: string;
  bsuid?: string;
}

export type GoogleLoginResult =
  | { type: "redirect"; url: string }
  | { type: "alreadySignedIn" };

export type WebGoogleLoginResult = { type: "redirect"; url: string };

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

  getAppLoginUrl(appAddress: string): string {
    if (!appAddress) {
      throw new ValidationException("Login provider ID is required");
    }
    return this.googleAuthGateway.getAppLoginUrl(appAddress);
  }

  async handleGoogleLogin(appAddress: string): Promise<GoogleLoginResult> {
    if (!appAddress) {
      throw new ValidationException("Login provider ID is required");
    }
    const user = await this.getUserByChatChannelAddress(appAddress);
    if (user?.googleCredential) {
      await this.refreshGoogleCredential(user);
      await this.mediator.send("SyncUserChatAddresses", {
        idUser: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        bsuid: user.bsuid,
      });
      return { type: "alreadySignedIn" };
    }
    const state = this.encryptAppAddress(appAddress);
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(state);
    return { type: "redirect", url };
  }

  async handleGoogleRedirect(
    state: string,
    code: string,
  ): Promise<GoogleRedirectResult> {
    const appAddress = this.decryptAppAddress(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(
      code,
      "app",
    );
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    await this.saveUserFromGoogleAuth(appAddress, userToken, userinfo, "app");
    return { type: "success" };
  }

  async handleWebGoogleLogin(): Promise<WebGoogleLoginResult> {
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(
      undefined,
      "web",
    );
    return { type: "redirect", url };
  }

  async handleWebGoogleRedirect(
    code: string,
  ): Promise<WebGoogleRedirectResult> {
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(
      code,
      "web",
    );
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    const user = await this.getUserByEmail(userinfo.email);
    if (!user) {
      throw new NotFoundException(
        "User not found",
        "Register this Google account in the app before signing in on the web.",
      );
    }
    if (!user.googleCredential) {
      throw new NotFoundException(
        "User not found",
        "Register this Google account in the app before signing in on the web.",
      );
    }
    user.updateGoogleCredential(
      userToken.accessToken,
      userToken.refreshToken,
      userToken.expiresInSeconds,
    );
    await this.saveGoogleCredential(user.googleCredential);
    await this.mediator.send("SyncUserChatAddresses", {
      idUser: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bsuid: user.bsuid,
    });
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
    if (!payload.userId || !payload.email) {
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

  private encryptAppAddress(appAddress: string): string {
    if (!appAddress) {
      throw new ValidationException("Login provider ID is required");
    }
    const encryption = new Encryption(this.encryptionConfig);
    return encryption.encrypt(appAddress);
  }

  private decryptAppAddress(state: string): string {
    if (!state) {
      throw new ValidationException("Login provider ID is required");
    }
    const encryption = new Encryption(this.encryptionConfig);
    const decrypted = encryption.decrypt(state);
    try {
      const parsed: unknown = JSON.parse(decrypted);
      if (typeof parsed === "object" && parsed !== null) {
        const { id } = parsed as { id?: string };
        if (id) return id;
      }
    } catch {}
    return decrypted;
  }

  async saveUserFromGoogleAuth(
    appAddress: string,
    userToken: GoogleTokens,
    userinfo: GoogleUserInfo,
    target: GoogleAuthTarget = "app",
  ): Promise<User> {
    const email = userinfo.email.toLowerCase();
    const userByEmail = await this.getUserByEmail(email);
    const aliasUser = await this.getUserByChatChannelAddress(appAddress);
    if (userByEmail && aliasUser && userByEmail.id !== aliasUser.id) {
      throw new UnauthorizedException(
        "The logged in Google account does not match this WhatsApp identity.",
        "Log in with the correct Google account and try again.",
      );
    }
    let user = userByEmail ?? aliasUser;
    if (user?.email && user.email !== email) {
      throw new UnauthorizedException(
        "The logged in Google account does not match this WhatsApp identity.",
        "Log in with the correct Google account and try again.",
      );
    }
    if (!user) {
      if (target === "web") {
        throw new NotFoundException(
          "User not found",
          "Register this phone number in the app before signing in on the web.",
        );
      }
      const phoneNumber = BsuidUtils.containsLetter(appAddress)
        ? undefined
        : PhoneNumberUtils.addDigitNine(appAddress);
      user = new User(userinfo.name, phoneNumber, email);
      if (BsuidUtils.containsLetter(appAddress)) {
        user.bsuid = appAddress;
      }
      user.createGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.createUser(user);
      await this.mediator.send("SyncUserChatAddresses", {
        idUser: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        bsuid: user.bsuid,
      });
      await this.mediator.send("SaveUserByGoogleCredential", appAddress);
      return user;
    }
    if (BsuidUtils.containsLetter(appAddress)) {
      user.bsuid = appAddress;
    } else {
      user.phoneNumber ??= PhoneNumberUtils.addDigitNine(appAddress);
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
    if (!user.email) {
      user.updateEmail(email);
    }
    await this.saveUser(user);
    await this.mediator.send("SyncUserChatAddresses", {
      idUser: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bsuid: user.bsuid,
    });
    return user;
  }

  async createUser(user: User): Promise<User> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await this.database.sql`
      INSERT INTO users (id, name, phone_number, email, bsuid, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${phoneNumber}, ${email}, ${bsuid}, ${user.createdAt}, ${user.updatedAt})
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

  async getUserByChatChannelAddress(id: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE bsuid = ${id}
        OR phone_number = ${id}
        OR lower(email) = ${id.toLowerCase()}
      LIMIT 1
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser);
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

  async getUserByBsuid(bsuid: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE bsuid = ${bsuid}
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const dbUsers = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE lower(email) = ${email.toLowerCase()}
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

  async deleteUserByChatChannelAddress(channelAddress: string): Promise<void> {
    await this.database.sql`
      DELETE FROM users
      WHERE id = (
        SELECT id FROM users
        WHERE bsuid = ${channelAddress}
          OR phone_number = ${channelAddress}
          OR lower(email) = ${channelAddress.toLowerCase()}
        LIMIT 1
      );
    `;
    await this.mediator.send("DeleteUserByChatChannelAddress", channelAddress);
  }

  async saveUser(user: User): Promise<void> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await this.database.sql`
      UPDATE users
      SET
        name = ${user.name},
        email = ${email},
        phone_number = ${phoneNumber},
        bsuid = ${bsuid},
        is_inactive = ${user.isInactive},
        updated_at = ${user.updatedAt}
      WHERE id = ${user.id}
    `;
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
    user.phoneNumber = dbUser.phone_number ?? undefined;
    user.email = dbUser.email ?? undefined;
    user.bsuid = dbUser.bsuid ?? undefined;
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
}

interface DbUser {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  bsuid: string | null;
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
