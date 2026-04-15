import { User } from "~/entities/User";
import { UnauthorizedException } from "~/infra/exceptions";
import { Encryption } from "~/infra/encryption";
import { Jwt } from "~/infra/jwt";
import { GoogleAuthScopes } from "~/resources/GoogleAuthScopes";
import { orquestrator } from "./orquestrator";

describe("AuthService", () => {
  test("getGoogleLoginUrl", () => {
    const phoneNumber = "5511984444444";
    const url = orquestrator.authService.getGoogleLoginUrl(phoneNumber);
    const uri = new URL(url);
    const params = uri.searchParams;

    expect(params.get("redirect_uri")).toBe(
      orquestrator.googleConfig.redirectUri,
    );

    const scope = params.get("scope");
    expect(scope).not.toBeNull();
    expect(scope).toContain(GoogleAuthScopes.spreadsheets);
    expect(scope).toContain(GoogleAuthScopes.tasks);
    expect(scope).toContain(GoogleAuthScopes.email);
    expect(scope).toContain(GoogleAuthScopes.profile);
    expect(scope).toContain(GoogleAuthScopes.openId);

    expect(params.get("client_id")).toBe(orquestrator.googleConfig.clientId);

    const encryption = new Encryption(orquestrator.encryptionConfig);
    const state = params.get("state");
    expect(state).not.toBeNull();
    expect(encryption.decrypt(state ?? "")).toBe(phoneNumber);
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

  test("saveUserByGoogleCredential", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber = "5511984444444";

    await expect(
      orquestrator.authService.saveUserByGoogleCredential(
        encryption.encrypt(phoneNumber),
        "wrongCode",
      ),
    ).rejects.toThrow();

    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.name).toBe("Save Google Credentials User");
    expect(users[0]?.phoneNumber).toBe("5511984444444");
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
      orquestrator.authService.saveUserByGoogleCredential(
        encryption.encrypt(phoneNumber),
        "rightCode",
      ),
    ).resolves.not.toThrow();
  });

  test("refreshGoogleCredential", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);

    await orquestrator.authService.saveUserByGoogleCredential(
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

    const phoneNumber1 = "5511984444444";
    let result = await orquestrator.authService.handleGoogleLogin(phoneNumber1);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const user = await orquestrator.createUser();
    result = await orquestrator.authService.handleGoogleLogin(user.phoneNumber);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber3 = "5511999888777";
    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber3),
      "rightCode",
    );
    result = await orquestrator.authService.handleGoogleLogin(phoneNumber3);
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

  test("saveUserByGoogleCredential persists email for new user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber = "5511984444444";

    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.email).toBe("savegooglecredentials@example.com");
  });

  test("saveUserByGoogleCredential backfills email on existing user", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber = "5511984444444";

    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    let user = await orquestrator.authService.getUserByPhoneNumber(phoneNumber);
    expect(user?.email).toBe("savegooglecredentials@example.com");

    // Simulate a legacy user that was stored without an email.
    await orquestrator.database
      .sql`UPDATE users SET email = NULL WHERE phone_number = ${phoneNumber}`;
    user = await orquestrator.authService.getUserByPhoneNumber(phoneNumber);
    expect(user?.email).toBeNull();

    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    user = await orquestrator.authService.getUserByPhoneNumber(phoneNumber);
    expect(user?.email).toBe("savegooglecredentials@example.com");
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

  test("getWebLoginUrl", () => {
    const url = orquestrator.authService.getWebLoginUrl();
    const uri = new URL(url);
    const params = uri.searchParams;
    expect(uri.hostname).toBe("accounts.google.com");
    expect(params.get("client_id")).toBe(orquestrator.googleConfig.clientId);
    const scope = params.get("scope");
    expect(scope).toContain(GoogleAuthScopes.email);
    expect(scope).toContain(GoogleAuthScopes.profile);
    expect(params.get("state")).toBeNull();
  });

  test("createWebToken and verifyWebToken round-trip", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);

    const token = await orquestrator.authService.createWebToken(user);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const payload = await orquestrator.authService.verifyWebToken(token);
    expect(payload.userId).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.phoneNumber).toBe(user.phoneNumber);
  });

  test("verifyWebToken rejects invalid and malformed tokens", async () => {
    await expect(
      orquestrator.authService.verifyWebToken("not-a-jwt"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const jwt = new Jwt(orquestrator.jwtConfig);
    const incompleteToken = await jwt.sign({ userId: "only-user-id" });
    await expect(
      orquestrator.authService.verifyWebToken(incompleteToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("handleWebGoogleRedirect throws when user is not registered", async () => {
    await orquestrator.clearDatabase();
    await expect(
      orquestrator.authService.handleWebGoogleRedirect("rightCode"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("handleWebGoogleRedirect returns registered user", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "savegooglecredentials@example.com";
    await orquestrator.authService.createUser(user);

    const result =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    expect(result.id).toBe(user.id);
    expect(result.email).toBe(user.email);
  });

  test("handleWebLogin returns user and valid token", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "savegooglecredentials@example.com";
    await orquestrator.authService.createUser(user);

    const result = await orquestrator.authService.handleWebLogin("rightCode");
    expect(result.user.id).toBe(user.id);
    expect(typeof result.token).toBe("string");

    const payload = await orquestrator.authService.verifyWebToken(result.token);
    expect(payload.userId).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.phoneNumber).toBe(user.phoneNumber);
  });

  test("handleWebLogin throws for unregistered user", async () => {
    await orquestrator.clearDatabase();
    await expect(
      orquestrator.authService.handleWebLogin("rightCode"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
});
