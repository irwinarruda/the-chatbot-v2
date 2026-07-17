import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import { Credential } from "~/modules/identity/entities/Credentials";
import type {
  GoogleLoginResultDTO,
  GoogleRedirectResultDTO,
  SyncUserChatAddressesDTO,
  WebAuthTokenPayloadDTO,
  WebGoogleLoginResultDTO,
  WebGoogleRedirectResultDTO,
} from "~/modules/identity/entities/dtos/IdentityDTO";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";
import { User } from "~/modules/identity/entities/User";
import type {
  AuthGateway,
  GoogleTokensDTO,
  GoogleUserInfoDTO,
} from "~/modules/identity/gateway/AuthGateway";
import type { GoogleCredentialEncryptionService } from "~/modules/identity/services/GoogleCredentialEncryptionService";
import { Jwt } from "~/modules/identity/services/Jwt";
import type { JwtConfig } from "~/shared/config/Config";
import {
  DeveloperException,
  NotFoundException,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

export interface IdentityChatCoordinator {
  deleteChat(channelAddress: string): Promise<void>;
  sendSignedInMessage(channelAddress: string): Promise<void>;
  syncUserChatAddresses(data: SyncUserChatAddressesDTO): Promise<void>;
}

const APP_LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export class AuthService {
  private database: DatabaseGateway;
  private jwtConfig: JwtConfig;
  private googleAuthGateway: AuthGateway;
  private googleCredentialEncryptionService: GoogleCredentialEncryptionService;
  private chatCoordinator: IdentityChatCoordinator;

  constructor(
    database: DatabaseGateway,
    jwtConfig: JwtConfig,
    googleAuthGateway: AuthGateway,
    googleCredentialEncryptionService: GoogleCredentialEncryptionService,
    chatCoordinator: IdentityChatCoordinator,
  ) {
    this.database = database;
    this.jwtConfig = jwtConfig;
    this.googleAuthGateway = googleAuthGateway;
    this.googleCredentialEncryptionService = googleCredentialEncryptionService;
    this.chatCoordinator = chatCoordinator;
  }

  async getAppLoginUrl(channelAddress: string): Promise<string> {
    if (!channelAddress) {
      throw new ValidationException("Login provider ID is required");
    }
    const challenge = randomBytes(16).toString("base64url");
    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + APP_LOGIN_CHALLENGE_TTL_MS,
    );
    await this.database.sql`
      DELETE FROM google_auth_challenges
      WHERE expires_at <= NOW()
    `;
    await this.database.sql`
      INSERT INTO google_auth_challenges (
        id,
        token_hash,
        channel_address,
        expires_at,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${this.hashAppLoginChallenge(challenge)},
        ${channelAddress},
        ${expiresAt},
        ${createdAt}
      )
    `;
    return this.googleAuthGateway.getAppLoginUrl(challenge);
  }

  async handleGoogleLogin(challenge: string): Promise<GoogleLoginResultDTO> {
    const appChallenge = await this.getActiveAppLoginChallenge(challenge);
    const user = await this.getUserByChatChannelAddress(
      appChallenge.channel_address,
    );
    if (user?.googleCredential) {
      const consumed = await this.database.sql<{ id: string }[]>`
        UPDATE google_auth_challenges
        SET consumed_at = ${new Date()}
        WHERE token_hash = ${this.hashAppLoginChallenge(challenge)}
          AND consumed_at IS NULL
          AND expires_at > NOW()
        RETURNING id
      `;
      if (!consumed[0]) {
        throw this.createInvalidAppLoginChallengeError();
      }
      return { type: "alreadySignedIn" };
    }
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(challenge);
    return { type: "redirect", url };
  }

  async handleGoogleRedirect(
    state: string,
    code: string,
  ): Promise<GoogleRedirectResultDTO> {
    await this.getActiveAppLoginChallenge(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(
      code,
      "app",
    );
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    const result = await this.database.transaction(async (sql) => {
      const appChallenge = await this.getActiveAppLoginChallenge(
        state,
        sql,
        true,
      );
      const saved = await this.saveUserFromGoogleAuth(
        appChallenge.channel_address,
        userToken,
        userinfo,
        sql,
      );
      await sql`
        UPDATE google_auth_challenges
        SET consumed_at = ${new Date()}
        WHERE id = ${appChallenge.id}
      `;
      return saved;
    });
    await this.chatCoordinator.syncUserChatAddresses({
      idUser: result.user.id,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber,
      bsuid: result.user.bsuid,
    });
    if (result.created) {
      await this.chatCoordinator.sendSignedInMessage(result.channelAddress);
    }
    return { type: "success" };
  }

  async handleWebGoogleLogin(): Promise<WebGoogleLoginResultDTO> {
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(
      undefined,
      "web",
    );
    return { type: "redirect", url };
  }

  async handleWebGoogleRedirect(
    code: string,
  ): Promise<WebGoogleRedirectResultDTO> {
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
    await this.chatCoordinator.syncUserChatAddresses({
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
    let payload: WebAuthTokenPayloadDTO;
    try {
      payload = await jwt.verify<WebAuthTokenPayloadDTO>(token);
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired authentication token",
        "Please log in again.",
      );
    }
    if (!payload.userId || !payload.email || payload.purpose !== "web-auth") {
      throw new UnauthorizedException(
        "Invalid authentication token",
        "Please log in again.",
      );
    }
    const user = await this.getUserById(payload.userId);
    if (!user || user.email !== payload.email || user.isInactive) {
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
      purpose: "web-auth",
    });
  }

  private async saveUserFromGoogleAuth(
    channelAddress: string,
    userToken: GoogleTokensDTO,
    userinfo: GoogleUserInfoDTO,
    sql: DatabaseGateway["sql"],
  ): Promise<GoogleAuthUserSaveResult> {
    const email = userinfo.email.toLowerCase();
    const userByEmail = await this.findUserByEmail(email, sql);
    const aliasUser = await this.findUserByChatChannelAddress(
      channelAddress,
      sql,
    );
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
      const phoneNumber = BsuidUtils.containsLetter(channelAddress)
        ? undefined
        : PhoneNumberUtils.addDigitNine(channelAddress);
      user = new User(userinfo.name, phoneNumber, email);
      if (BsuidUtils.containsLetter(channelAddress)) {
        user.bsuid = channelAddress;
      }
      user.createGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.insertUser(user, sql);
      return { user, channelAddress, created: true };
    }
    if (BsuidUtils.containsLetter(channelAddress)) {
      user.bsuid = channelAddress;
    } else {
      user.phoneNumber ??= PhoneNumberUtils.addDigitNine(channelAddress);
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
      const googleCredential = user.googleCredential;
      await this.createGoogleCredential(googleCredential, sql);
      if (!user.email) user.updateEmail(email);
      await this.saveUser(user, sql);
    } else {
      user.updateGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      const googleCredential = user.googleCredential;
      await this.saveGoogleCredential(googleCredential, sql);
      if (!user.email) user.updateEmail(email);
      await this.saveUser(user, sql);
    }
    return { user, channelAddress, created: false };
  }

  async createUser(user: User): Promise<User> {
    await this.database.transaction(async (sql) => {
      await this.insertUser(user, sql);
    });
    return user;
  }

  async getUserByChatChannelAddress(id: string): Promise<User | undefined> {
    return this.findUserByChatChannelAddress(id, this.database.sql);
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
    return this.findUserByEmail(email, this.database.sql);
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

  async deleteUserById(idUser: string, channelAddress: string): Promise<void> {
    await this.database.sql`
      DELETE FROM users
      WHERE id = ${idUser}
    `;
    await this.chatCoordinator.deleteChat(channelAddress);
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
    await this.chatCoordinator.deleteChat(channelAddress);
  }

  private async findUserByChatChannelAddress(
    id: string,
    sql: DatabaseGateway["sql"],
  ): Promise<User | undefined> {
    const dbUsers = await sql<DbUser[]>`
      SELECT * FROM users
      WHERE bsuid = ${id}
        OR phone_number = ${id}
        OR lower(email) = ${id.toLowerCase()}
      LIMIT 1
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser, sql);
  }

  private async findUserByEmail(
    email: string,
    sql: DatabaseGateway["sql"],
  ): Promise<User | undefined> {
    const dbUsers = await sql<DbUser[]>`
      SELECT * FROM users
      WHERE lower(email) = ${email.toLowerCase()}
    `;
    const dbUser = dbUsers[0];
    if (!dbUser) return undefined;
    return this.hydrateUser(dbUser, sql);
  }

  private async getActiveAppLoginChallenge(
    challenge: string,
    sql: DatabaseGateway["sql"] = this.database.sql,
    lock = false,
  ): Promise<DbGoogleAuthChallenge> {
    if (!/^[A-Za-z0-9_-]{22}$/.test(challenge)) {
      throw this.createInvalidAppLoginChallengeError();
    }
    const tokenHash = this.hashAppLoginChallenge(challenge);
    let challenges: DbGoogleAuthChallenge[];
    if (lock) {
      challenges = await sql<DbGoogleAuthChallenge[]>`
        SELECT *
        FROM google_auth_challenges
        WHERE token_hash = ${tokenHash}
          AND consumed_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
      `;
    } else {
      challenges = await sql<DbGoogleAuthChallenge[]>`
        SELECT *
        FROM google_auth_challenges
        WHERE token_hash = ${tokenHash}
          AND consumed_at IS NULL
          AND expires_at > NOW()
      `;
    }
    const appChallenge = challenges[0];
    if (!appChallenge) {
      throw this.createInvalidAppLoginChallengeError();
    }
    return appChallenge;
  }

  private hashAppLoginChallenge(challenge: string): Buffer {
    return createHash("sha256").update(challenge).digest();
  }

  private createInvalidAppLoginChallengeError(): UnauthorizedException {
    return new UnauthorizedException(
      "Invalid or expired login link",
      "Request a new login link in WhatsApp and try again.",
    );
  }

  private async insertUser(
    user: User,
    sql: DatabaseGateway["sql"],
  ): Promise<void> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await sql`
      INSERT INTO users (id, name, phone_number, email, bsuid, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${phoneNumber}, ${email}, ${bsuid}, ${user.createdAt}, ${user.updatedAt})
    `;
    if (user.googleCredential) {
      await this.createGoogleCredential(user.googleCredential, sql);
    }
  }

  private async saveUser(
    user: User,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await sql`
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
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    const tokenEnvelope =
      this.googleCredentialEncryptionService.encrypt(googleCredential);
    await sql`
      UPDATE google_credentials
      SET
        token_envelope = ${sql.json(tokenEnvelope)},
        expires_in_seconds = ${expiresInSeconds},
        expiration_date = ${expirationDate},
        updated_at = ${googleCredential.updatedAt}
      WHERE id = ${googleCredential.id}
    `;
  }

  private async createGoogleCredential(
    googleCredential: Credential,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    const tokenEnvelope =
      this.googleCredentialEncryptionService.encrypt(googleCredential);
    await sql`
      INSERT INTO google_credentials (
        id,
        id_user,
        token_envelope,
        expires_in_seconds,
        expiration_date,
        created_at,
        updated_at
      )
      VALUES (
        ${googleCredential.id},
        ${googleCredential.idUser},
        ${sql.json(tokenEnvelope)},
        ${expiresInSeconds},
        ${expirationDate},
        ${googleCredential.createdAt},
        ${googleCredential.updatedAt}
      )
    `;
  }

  private async hydrateUser(
    dbUser: DbUser,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<User> {
    const dbCredentials = await sql<DbGoogleCredential[]>`
      SELECT * FROM google_credentials
      WHERE id_user = ${dbUser.id}
    `;
    const dbCred = dbCredentials[0];
    let googleCredential: Credential | undefined;
    if (dbCred) {
      const { accessToken, refreshToken } =
        this.googleCredentialEncryptionService.decrypt(
          dbCred.token_envelope,
          dbCred.id,
          dbCred.id_user,
        );
      googleCredential = Credential.restore({
        id: dbCred.id,
        idUser: dbCred.id_user,
        accessToken,
        refreshToken,
        expiresInSeconds: dbCred.expires_in_seconds ?? undefined,
        expirationDate: dbCred.expiration_date ?? undefined,
        createdAt: dbCred.created_at,
        updatedAt: dbCred.updated_at,
      });
    }
    return User.restore({
      id: dbUser.id,
      name: dbUser.name,
      phoneNumber: dbUser.phone_number ?? undefined,
      email: dbUser.email ?? undefined,
      bsuid: dbUser.bsuid ?? undefined,
      isInactive: dbUser.is_inactive,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      googleCredential,
    });
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
  token_envelope: unknown;
  expires_in_seconds: number | null;
  expiration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DbGoogleAuthChallenge {
  id: string;
  token_hash: Buffer;
  channel_address: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

interface GoogleAuthUserSaveResult {
  user: User;
  channelAddress: string;
  created: boolean;
}
