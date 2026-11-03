import type { WebAuthTokenPayloadDTO } from "~/contracts/http/identity/identity";
import { BsuidUtils } from "~/domain/identity/bsuid";
import type {
  GoogleLoginResultDTO,
  GoogleTokensDTO,
  GoogleUserInfoDTO,
  WebGoogleLoginResultDTO,
} from "~/domain/identity/google-auth";
import { PhoneNumberUtils } from "~/domain/identity/phone-number";
import { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AuthGateway } from "~/server/modules/identity/gateways/auth";
import type {
  GoogleAuthChallenge,
  GoogleAuthChallengeRepository,
} from "~/server/modules/identity/repositories/google-auth-challenge.repository";
import type { UserRepository } from "~/server/modules/identity/repositories/user.repository";
import { Jwt } from "~/server/modules/identity/utils/jwt";
import type { JwtConfig } from "~/server/shared/config/config";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/server/shared/database/database";
import {
  DeveloperException,
  NotFoundException,
  UnauthorizedException,
} from "~/server/shared/errors/application-errors";

const APP_LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export interface GoogleSignInDTO {
  user: User;
  channelAddress: string;
  isNewUser: boolean;
}

export class AuthService {
  constructor(
    private database: DatabaseGateway,
    private users: UserRepository,
    private challenges: GoogleAuthChallengeRepository,
    private jwtConfig: JwtConfig,
    private googleAuthGateway: AuthGateway,
  ) {}

  async getAppLoginUrl(channelAddress: string): Promise<string> {
    if (!channelAddress) {
      throw new ValidationException("Login provider ID is required");
    }
    const challenge = await this.challenges.issue(
      channelAddress,
      APP_LOGIN_CHALLENGE_TTL_MS,
    );
    return this.googleAuthGateway.getAppLoginUrl(challenge);
  }

  async handleGoogleLogin(challenge: string): Promise<GoogleLoginResultDTO> {
    const appChallenge = await this.getActiveAppLoginChallenge(challenge);
    const user = await this.getUserByChatChannelAddress(
      appChallenge.channelAddress,
    );
    if (user?.googleCredential) {
      const isConsumed = await this.challenges.consumeActive(challenge);
      if (!isConsumed) {
        throw createInvalidAppLoginChallengeError();
      }
      return { type: "alreadySignedIn" };
    }
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(challenge);
    return { type: "redirect", url };
  }

  async handleGoogleRedirect(
    state: string,
    code: string,
  ): Promise<GoogleSignInDTO> {
    await this.getActiveAppLoginChallenge(state);
    const userToken = await this.googleAuthGateway.exchangeCodeForTokens(
      code,
      "app",
    );
    const userinfo = await this.googleAuthGateway.getUserInfo(
      userToken.accessToken,
    );
    return this.database.transaction(async (sql) => {
      const appChallenge = await this.getActiveAppLoginChallenge(
        state,
        sql,
        true,
      );
      const signIn = await this.saveUserFromGoogleAuth(
        appChallenge.channelAddress,
        userToken,
        userinfo,
        sql,
      );
      await this.challenges.consume(appChallenge.id, sql);
      return signIn;
    });
  }

  async handleWebGoogleLogin(state: string): Promise<WebGoogleLoginResultDTO> {
    const url = this.googleAuthGateway.createAuthorizationCodeUrl(state, "web");
    return { type: "redirect", url };
  }

  async handleWebGoogleRedirect(code: string): Promise<User> {
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
      await this.users.createCredential(user.googleCredential);
    } else {
      user.updateGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.users.saveCredential(user.googleCredential);
    }
    return user;
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
    await this.users.saveCredential(user.googleCredential);
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

  async createUser(user: User): Promise<User> {
    await this.database.transaction(async (sql) => {
      await this.users.create(user, sql);
    });
    return user;
  }

  async getUserByChatChannelAddress(id: string): Promise<User | undefined> {
    return this.users.findByChannelAddress(id);
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    return this.users.findByPhoneNumber(phoneNumber);
  }

  async getUserByBsuid(bsuid: string): Promise<User | undefined> {
    return this.users.findByBsuid(bsuid);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.findByEmail(email);
  }

  async getUsers(): Promise<User[]> {
    return this.users.list();
  }

  async deleteUserById(idUser: string): Promise<void> {
    await this.users.deleteById(idUser);
  }

  async deleteUserByChatChannelAddress(channelAddress: string): Promise<void> {
    await this.users.deleteByChannelAddress(channelAddress);
  }

  private async saveUserFromGoogleAuth(
    channelAddress: string,
    userToken: GoogleTokensDTO,
    userinfo: GoogleUserInfoDTO,
    sql: DatabaseGatewaySql,
  ): Promise<GoogleSignInDTO> {
    const email = userinfo.email.toLowerCase();
    const userByEmail = await this.users.findByEmail(email, sql);
    const aliasUser = await this.users.findByChannelAddress(
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
      await this.users.create(user, sql);
      return { user, channelAddress, isNewUser: true };
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
      await this.users.createCredential(user.googleCredential, sql);
    } else {
      user.updateGoogleCredential(
        userToken.accessToken,
        userToken.refreshToken,
        userToken.expiresInSeconds,
      );
      await this.users.saveCredential(user.googleCredential, sql);
    }
    if (!user.email) user.updateEmail(email);
    await this.users.save(user, sql);
    return { user, channelAddress, isNewUser: false };
  }

  private async getActiveAppLoginChallenge(
    challenge: string,
    sql?: DatabaseGatewaySql,
    isLocked = false,
  ): Promise<GoogleAuthChallenge> {
    if (!/^[A-Za-z0-9_-]{22}$/.test(challenge)) {
      throw createInvalidAppLoginChallengeError();
    }
    const appChallenge = await this.challenges.findActive(
      challenge,
      sql,
      isLocked,
    );
    if (!appChallenge) {
      throw createInvalidAppLoginChallengeError();
    }
    return appChallenge;
  }
}

function createInvalidAppLoginChallengeError(): UnauthorizedException {
  return new UnauthorizedException(
    "Invalid or expired login link",
    "Request a new login link in WhatsApp and try again.",
  );
}
