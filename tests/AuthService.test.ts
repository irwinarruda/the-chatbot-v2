import { Encryption } from "~/infra/encryption";
import {
  DeveloperException,
  NotFoundException,
  UnauthorizedException,
} from "~/infra/exceptions";
import { Jwt } from "~/infra/jwt";
import { GoogleAuthScopes } from "~/server/resources/GoogleAuthScopes";
import type { IGoogleAuthGateway } from "~/server/resources/IGoogleAuthGateway";
import { User } from "~/shared/entities/User";
import { orquestrator } from "./orquestrator";

describe("AuthService", () => {
  test("handleGoogleLogin returns Google auth redirect URL", async () => {
    const id = "5511984444444";
    const result = await orquestrator.authService.handleGoogleLogin(id);
    expect(result.type).toBe("redirect");
    if (result.type !== "redirect") {
      return;
    }

    const url = result.url;
    const uri = new URL(url);
    const params = uri.searchParams;

    expect(params.get("redirect_uri")).toBe(
      orquestrator.googleConfig.redirectUri,
    );

    const scope = params.get("scope");
    expect(scope).not.toBeNull();
    expect(scope).toContain(GoogleAuthScopes.spreadsheets);
    expect(scope).toContain(GoogleAuthScopes.email);
    expect(scope).toContain(GoogleAuthScopes.profile);
    expect(scope).toContain(GoogleAuthScopes.openId);

    expect(params.get("client_id")).toBe(orquestrator.googleConfig.clientId);

    const encryption = new Encryption(orquestrator.encryptionConfig);
    const state = params.get("state");
    expect(state).not.toBeNull();
    expect(encryption.decrypt(state ?? "")).toBe(id);
  });

  test("createUser", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511984444444";
    const user = new User("Irwin Arruda", phoneNumber);
    await orquestrator.authService.createUser(user);
    expect(user.name).toBe("Irwin Arruda");
    expect(user.phoneNumber).toBe(phoneNumber);
    expect(user.googleCredential).toBeUndefined();
    expect(user.isInactive).toBe(false);
    expect(user.createdAt.toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(user.updatedAt.toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10),
    );
  });

  test("getUsers", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser();
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.id).toBe(user.id);
    expect(users[0]?.name).toBe(user.name);
    expect(users[0]?.phoneNumber).toBe(user.phoneNumber);
    expect(users[0]?.isInactive).toBe(user.isInactive);
    expect(users[0]?.googleCredential).toBeUndefined();
    expect(users[0]?.createdAt.getTime()).toBe(user.createdAt.getTime());
    expect(users[0]?.updatedAt.getTime()).toBe(user.updatedAt.getTime());
  });

  test("handleGoogleRedirect persists Google credentials", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber = "5511984444444";

    await expect(
      orquestrator.authService.handleGoogleRedirect(
        encryption.encrypt(phoneNumber),
        "wrongCode",
      ),
    ).rejects.toThrow();

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.name).toBe("Save Google Credentials User");
    expect(users[0]?.phoneNumber).toBe("5511984444444");
    expect(users[0]?.bsuid).toBeUndefined();
    expect(users[0]?.googleCredential).toBeDefined();
    expect(users[0]?.googleCredential?.accessToken).toBe(
      "ya29.a0ARrdaM9test_access_token_123456789",
    );
    expect(users[0]?.googleCredential?.refreshToken).toBe(
      "1//0G_refresh_token_test_abcdefghijklmnopqrstuvwxyz",
    );
    const createdAt = users[0]?.googleCredential?.createdAt;
    const updatedAt = users[0]?.googleCredential?.updatedAt;
    expect(createdAt?.getTime()).toBe(updatedAt?.getTime());

    await expect(
      orquestrator.authService.handleGoogleRedirect(
        encryption.encrypt(phoneNumber),
        "rightCode",
      ),
    ).resolves.toEqual({ type: "success" });
  });

  test("handleGoogleRedirect exchanges code with the app redirect target", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const gateway =
      orquestrator.container.resolve<IGoogleAuthGateway>("IGoogleAuthGateway");
    const spy = vi.spyOn(gateway, "exchangeCodeForTokens");

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt("5511984444444"),
      "rightCode",
    );

    expect(spy).toHaveBeenCalledWith("rightCode", "app");
  });

  test("refreshGoogleCredential", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt("5511984444444"),
      "rightCode",
    );
    const users = await orquestrator.authService.getUsers();
    expect(users[0]?.googleCredential?.accessToken).toBe(
      "ya29.a0ARrdaM9test_access_token_123456789",
    );
    expect(users[0]?.googleCredential?.refreshToken).toBe(
      "1//0G_refresh_token_test_abcdefghijklmnopqrstuvwxyz",
    );

    const refreshedUser = users[0];
    if (!refreshedUser) return;
    await orquestrator.authService.refreshGoogleCredential(refreshedUser);
    expect(refreshedUser).toBeDefined();
    expect(refreshedUser.googleCredential?.accessToken).toBe(
      "ya29.a0ARrdaM9refreshed_access_token_123456789",
    );
    expect(refreshedUser.googleCredential?.refreshToken).toBe(
      "1//0G_refresh_token_refreshed_abcdefghijklmnopqrstuvwxyz",
    );

    const createdAt = refreshedUser.googleCredential?.createdAt;
    const updatedAt = refreshedUser.googleCredential?.updatedAt;
    expect(createdAt?.getTime()).not.toBe(updatedAt?.getTime());
  });

  test("handleGoogleLogin", async () => {
    await orquestrator.clearDatabase();

    const id1 = "5511984444444";
    let result = await orquestrator.authService.handleGoogleLogin(id1);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const user = await orquestrator.createUser();
    result = await orquestrator.authService.handleGoogleLogin(
      user.phoneNumber ?? "",
    );
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id3 = "5511999888777";
    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id3),
      "rightCode",
    );
    result = await orquestrator.authService.handleGoogleLogin(id3);
    expect(result.type).toBe("alreadySignedIn");
  });

  test("handleGoogleRedirect", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);

    const phoneNumber1 = "5511984444444";
    const state = encryption.encrypt(phoneNumber1);
    let result = await orquestrator.authService.handleGoogleRedirect(
      state,
      "rightCode",
    );
    expect(result.type).toBe("success");
    let users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();

    const phoneNumber2 = "5511987654321";
    const state2 = encryption.encrypt(phoneNumber2);
    await expect(
      orquestrator.authService.handleGoogleRedirect(state2, "wrongCode"),
    ).rejects.toThrow();

    result = await orquestrator.authService.handleGoogleRedirect(
      state,
      "rightCode",
    );
    expect(result.type).toBe("success");
    users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();
  });

  test("handleGoogleRedirect persists email for new user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber = "5511984444444";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.email).toBe("savegooglecredentials@example.com");
  });

  test("handleGoogleRedirect backfills email on existing user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    let user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user?.email).toBe("savegooglecredentials@example.com");

    // Simulate a legacy user that was stored without an email.
    await orquestrator.database
      .sql`UPDATE users SET email = NULL WHERE phone_number = ${id}`;
    user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user?.email).toBeUndefined();

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user?.email).toBe("savegooglecredentials@example.com");
  });

  test("handleGoogleRedirect rejects mismatched email for existing user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";
    const user = new User("Irwin Arruda", id);
    user.email = "another@example.com";
    await orquestrator.authService.createUser(user);

    await expect(
      orquestrator.authService.handleGoogleRedirect(
        encryption.encrypt(id),
        "rightCode",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const unchangedUser =
      await orquestrator.authService.getUserByPhoneNumber(id);
    expect(unchangedUser?.email).toBe("another@example.com");
    expect(unchangedUser?.googleCredential).toBeUndefined();
  });

  test("getUserByEmail", async () => {
    await orquestrator.clearDatabase();
    expect(
      await orquestrator.authService.getUserByEmail("missing@example.com"),
    ).toBeUndefined();

    const phoneNumber = "5511984444444";
    const email = "user@example.com";
    const user = new User("Irwin Arruda", phoneNumber);
    user.email = email;
    await orquestrator.authService.createUser(user);

    const found = await orquestrator.authService.getUserByEmail(email);
    expect(found).toBeDefined();
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe(email);
    expect(found?.phoneNumber).toBe(phoneNumber);
  });

  test("handleWebGoogleLogin", async () => {
    await orquestrator.clearDatabase();

    const result = await orquestrator.authService.handleWebGoogleLogin();
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      const uri = new URL(result.url);
      const params = uri.searchParams;
      expect(uri.hostname).toBe("accounts.google.com");
      expect(params.get("client_id")).toBe(orquestrator.googleConfig.clientId);
      expect(params.get("redirect_uri")).toBe(
        orquestrator.googleConfig.webRedirectUri ||
          orquestrator.googleConfig.redirectUri,
      );
      const scope = params.get("scope");
      expect(scope).toContain(GoogleAuthScopes.email);
      expect(scope).toContain(GoogleAuthScopes.profile);
      expect(params.get("state")).toBeNull();
    }
  });

  test("handleWebGoogleRedirect returns user and valid token for existing credentialed user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511999888777";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    const user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user).toBeDefined();

    const token =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(token);

    expect(authenticatedUser.phoneNumber).toBe(id);
    expect(authenticatedUser.email).toBe("savegooglecredentials@example.com");
  });

  test("handleWebGoogleRedirect exchanges code with the web redirect target", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt("5511999888777"),
      "rightCode",
    );
    const gateway =
      orquestrator.container.resolve<IGoogleAuthGateway>("IGoogleAuthGateway");
    const spy = vi.spyOn(gateway, "exchangeCodeForTokens");

    await orquestrator.authService.handleWebGoogleRedirect("rightCode");

    expect(spy).toHaveBeenCalledWith("rightCode", "web");
  });

  test("createWebToken and authenticateWebUser round-trip", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);

    const token = await orquestrator.authService.createWebToken(user);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(token);
    expect(authenticatedUser.id).toBe(user.id);
    expect(authenticatedUser.email).toBe(user.email);
    expect(authenticatedUser.phoneNumber).toBe(user.phoneNumber);
  });

  test("authenticateWebUser rejects invalid and malformed tokens", async () => {
    await expect(
      orquestrator.authService.authenticateWebUser("not-a-jwt"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const jwt = new Jwt(orquestrator.jwtConfig);
    const incompleteToken = await jwt.sign({ userId: "only-user-id" });
    await expect(
      orquestrator.authService.authenticateWebUser(incompleteToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("handleWebGoogleRedirect updates credentials for an eligible user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    const token =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(token);
    expect(authenticatedUser.phoneNumber).toBe(id);

    const persistedUser =
      await orquestrator.authService.getUserByPhoneNumber(id);
    expect(persistedUser?.googleCredential).toBeDefined();
    expect(persistedUser?.email).toBe("savegooglecredentials@example.com");
  });

  test("handleWebGoogleRedirect returns the matching email user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    const user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user).toBeDefined();

    const token =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(token);
    expect(authenticatedUser.id).toBe(user?.id);
    expect(authenticatedUser.email).toBe(user?.email);
  });

  test("handleWebGoogleRedirect returns user and valid token", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(id),
      "rightCode",
    );
    const user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user).toBeDefined();

    const result =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    expect(typeof result).toBe("string");

    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(result);
    expect(authenticatedUser.id).toBe(user?.id);
    expect(authenticatedUser.email).toBe(user?.email);
    expect(authenticatedUser.phoneNumber).toBe(user?.phoneNumber);
  });

  test("handleWebGoogleRedirect rejects matching email users without Google credentials", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "savegooglecredentials@example.com";
    await orquestrator.authService.createUser(user);

    await expect(
      orquestrator.authService.handleWebGoogleRedirect("rightCode"),
    ).rejects.toBeInstanceOf(NotFoundException);

    const unchangedUser =
      await orquestrator.authService.getUserByPhoneNumber("5511984444444");
    expect(unchangedUser?.email).toBe("savegooglecredentials@example.com");
    expect(unchangedUser?.googleCredential).toBeUndefined();
  });

  test("handleWebGoogleRedirect rejects unknown emails without creating users", async () => {
    await orquestrator.clearDatabase();
    await expect(
      orquestrator.authService.handleWebGoogleRedirect("rightCode"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await orquestrator.authService.getUsers()).toHaveLength(0);
  });

  test("authenticateWebUser returns authenticated user from token", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);

    const token = await orquestrator.authService.createWebToken(user);
    const authenticatedUser =
      await orquestrator.authService.authenticateWebUser(token);

    expect(authenticatedUser.id).toBe(user.id);
    expect(authenticatedUser.email).toBe(user.email);
    expect(authenticatedUser.phoneNumber).toBe(user.phoneNumber);
  });

  test("authenticateWebUser rejects missing or stale users", async () => {
    await orquestrator.clearDatabase();

    await expect(
      orquestrator.authService.authenticateWebUser(""),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);

    const token = await orquestrator.authService.createWebToken(user);
    await orquestrator.database.sql`DELETE FROM users WHERE id = ${user.id}`;

    await expect(
      orquestrator.authService.authenticateWebUser(token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("auth validation paths reject empty inputs and missing credentials", async () => {
    await expect(
      orquestrator.authService.handleGoogleLogin(""),
    ).rejects.toThrow("Login provider ID is required");
    await expect(
      orquestrator.authService.handleGoogleRedirect("", "rightCode"),
    ).rejects.toThrow("Login provider ID is required");

    const user = new User("Irwin Arruda", "5511984444444");
    await expect(
      orquestrator.authService.refreshGoogleCredential(user),
    ).rejects.toThrow("Something went wrong refreshing user credentials.");
  });

  test("handleGoogleRedirect creates user with email and BSUID when phone is absent", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const bsuid = "BR.13491208655302741918";
    const state = encryption.encrypt(bsuid);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const user = await orquestrator.authService.getUserByBsuid(bsuid);
    expect(user?.email).toBe("savegooglecredentials@example.com");
    expect(user?.phoneNumber).toBeUndefined();
    expect(user?.bsuid).toBe(bsuid);
  });

  test("handleGoogleRedirect links an existing email user to the app BSUID", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const bsuid = "BR.13491208655302741918";
    const email = "savegooglecredentials@example.com";
    const existingUser = new User("Existing User", undefined, email);
    await orquestrator.authService.createUser(existingUser);

    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(bsuid),
      "rightCode",
    );

    const users = await orquestrator.authService.getUsers();
    const userByEmail = await orquestrator.authService.getUserByEmail(email);
    const userByBsuid = await orquestrator.authService.getUserByBsuid(bsuid);
    expect(users).toHaveLength(1);
    expect(userByEmail?.id).toBe(existingUser.id);
    expect(userByBsuid?.id).toBe(existingUser.id);
    expect(userByEmail?.bsuid).toBe(bsuid);
    expect(userByEmail?.phoneNumber).toBeUndefined();
    expect(userByEmail?.googleCredential?.accessToken).toBe(
      "ya29.a0ARrdaM9test_access_token_123456789",
    );
  });

  test("handleGoogleRedirect rejects conflicting email and alias users", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const id = "5511984444444";
    const emailUser = new User(
      "Email User",
      undefined,
      "savegooglecredentials@example.com",
    );
    await orquestrator.authService.createUser(emailUser);
    const aliasUser = new User("Alias User");
    aliasUser.bsuid = id;
    await orquestrator.authService.createUser(aliasUser);

    await expect(
      orquestrator.authService.handleGoogleRedirect(
        encryption.encrypt(id),
        "rightCode",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("authenticateWebUser accepts tokens without phone", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", undefined, "user@example.com");
    await orquestrator.authService.createUser(user);
    const token = await orquestrator.authService.createWebToken(user);
    const authenticated =
      await orquestrator.authService.authenticateWebUser(token);
    expect(authenticated.email).toBe("user@example.com");
    expect(authenticated.phoneNumber).toBeUndefined();
  });

  test("saveUserFromGoogleAuth throws if credential creation is bypassed unexpectedly", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444", "user@example.com");
    await orquestrator.authService.createUser(user);

    const service = orquestrator.authService as unknown as {
      saveUserFromGoogleAuth: (
        providerId: string,
        userToken: {
          accessToken: string;
          refreshToken: string;
          expiresInSeconds?: number;
        },
        userinfo: { name: string; email: string },
      ) => Promise<User>;
      getUserByEmail: (email: string) => Promise<User | undefined>;
      getUserByChatChannelAddress: (
        providerId: string,
      ) => Promise<User | undefined>;
    };
    const createGoogleCredential = user.createGoogleCredential.bind(user);
    const getUserByEmail = service.getUserByEmail;
    const getUserByChatChannelAddress = service.getUserByChatChannelAddress;
    user.createGoogleCredential = () => {};
    service.getUserByEmail = vi.fn().mockResolvedValue(undefined);
    service.getUserByChatChannelAddress = vi.fn().mockResolvedValue(user);

    await expect(
      service.saveUserFromGoogleAuth(
        "5511984444444",
        {
          accessToken: "access",
          refreshToken: "refresh",
          expiresInSeconds: 3600,
        },
        {
          name: user.name,
          email: user.email ?? "user@example.com",
        },
      ),
    ).rejects.toBeInstanceOf(DeveloperException);

    user.createGoogleCredential = createGoogleCredential;
    service.getUserByEmail = getUserByEmail;
    service.getUserByChatChannelAddress = getUserByChatChannelAddress;
  });

  test("deleteUserByChatChannelAddress deletes user by phone number", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511984444444";
    await orquestrator.createUser({ phoneNumber });
    const sendSpy = vi
      .spyOn(orquestrator.mediator, "send")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(phoneNumber);
    expect(
      await orquestrator.authService.getUserByPhoneNumber(phoneNumber),
    ).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledWith(
      "DeleteUserByChatChannelAddress",
      phoneNumber,
    );
    sendSpy.mockRestore();
  });

  test("deleteUserByChatChannelAddress deletes user by BSUID", async () => {
    await orquestrator.clearDatabase();
    const bsuid = "BR.13491208655302741918";
    const user = new User("BSUID User");
    user.bsuid = bsuid;
    await orquestrator.authService.createUser(user);
    const sendSpy = vi
      .spyOn(orquestrator.mediator, "send")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(bsuid);
    expect(
      await orquestrator.authService.getUserByBsuid(bsuid),
    ).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledWith(
      "DeleteUserByChatChannelAddress",
      bsuid,
    );
    sendSpy.mockRestore();
  });

  test("deleteUserByChatChannelAddress deletes user by email", async () => {
    await orquestrator.clearDatabase();
    const email = "delete-user@example.com";
    await orquestrator.createUser({ email });
    const sendSpy = vi
      .spyOn(orquestrator.mediator, "send")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(email);
    expect(
      await orquestrator.authService.getUserByEmail(email),
    ).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledWith(
      "DeleteUserByChatChannelAddress",
      email,
    );
    sendSpy.mockRestore();
  });
});
