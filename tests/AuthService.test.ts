import { User } from "~/modules/identity/entities/User";
import { GoogleAuthScopes } from "~/modules/identity/gateway/AuthGateway/GoogleAuthScopes";
import { Jwt } from "~/modules/identity/services/Jwt";
import {
  NotFoundException,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import {
  createAppGoogleLoginChallenge,
  createAppGoogleLoginState,
} from "./createAppGoogleLoginState";
import { orquestrator } from "./orquestrator";

describe("AuthService", () => {
  test("stores new Google credentials in one encrypted envelope", async () => {
    await orquestrator.clearDatabase();
    const user = new User(
      "Encrypted User",
      "5511984444444",
      "encrypted@example.com",
    );
    user.createGoogleCredential("plain-access-token", "plain-refresh-token");

    await orquestrator.authService.createUser(user);

    const rows = await orquestrator.database.sql<
      {
        token_envelope: Record<string, unknown>;
      }[]
    >`
      SELECT token_envelope
      FROM google_credentials
      WHERE id_user = ${user.id}
    `;
    expect(rows[0]?.token_envelope).toMatchObject({
      nonce: expect.any(String),
      ciphertext: expect.any(String),
      authenticationTag: expect.any(String),
    });
    expect(JSON.stringify(rows[0])).not.toContain("plain-access-token");
    expect(JSON.stringify(rows[0])).not.toContain("plain-refresh-token");

    const restored = await orquestrator.authService.getUserById(user.id);
    expect(restored?.googleCredential?.accessToken).toBe("plain-access-token");
    expect(restored?.googleCredential?.refreshToken).toBe(
      "plain-refresh-token",
    );
  });

  test("WhatsApp challenge starts the Google auth flow without exposing the address", async () => {
    await orquestrator.clearDatabase();
    const id = "5511984444444";
    const loginUrl = await orquestrator.authService.getAppLoginUrl(id);
    const challenge = new URL(loginUrl).pathname.split("/").at(-1);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(new URL(loginUrl).pathname).toBe(`/g/${challenge}`);
    expect(loginUrl).not.toContain(id);

    const stored = await orquestrator.database.sql<
      { channel_address: string; token_hash: Buffer }[]
    >`SELECT channel_address, token_hash FROM google_auth_challenges`;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.channel_address).toBe(id);
    expect(stored[0]?.token_hash).toHaveLength(32);
    expect(stored[0]?.token_hash.toString("base64url")).not.toBe(challenge);

    const result = await orquestrator.authService.handleGoogleLogin(
      challenge ?? "",
    );
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

    const state = params.get("state");
    expect(state).toBe(challenge);
  });

  test("app login rejects raw addresses and expired challenges", async () => {
    await orquestrator.clearDatabase();
    await expect(
      orquestrator.authService.handleGoogleLogin("5511984444444"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const challenge = await createAppGoogleLoginChallenge(
      orquestrator.authService,
      "5511984444444",
    );
    await orquestrator.database.sql`
      UPDATE google_auth_challenges
      SET expires_at = ${new Date(0)}
    `;

    await expect(
      orquestrator.authService.handleGoogleLogin(challenge),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
    const phoneNumber = "5511984444444";
    const invalidCodeState = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber,
    );

    await expect(
      orquestrator.authService.handleGoogleRedirect(
        invalidCodeState,
        "wrongCode",
      ),
    ).rejects.toThrow();

    await orquestrator.authService.handleGoogleRedirect(
      invalidCodeState,
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
        invalidCodeState,
        "rightCode",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("concurrent callbacks consume a WhatsApp challenge exactly once", async () => {
    await orquestrator.clearDatabase();
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      "5511984444444",
    );

    const results = await Promise.allSettled([
      orquestrator.authService.handleGoogleRedirect(state, "rightCode"),
      orquestrator.authService.handleGoogleRedirect(state, "rightCode"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await orquestrator.authService.getUsers()).toHaveLength(1);
  });

  test("handleGoogleRedirect exchanges code with the app redirect target", async () => {
    await orquestrator.clearDatabase();
    const gateway = orquestrator.googleAuthGateway;
    const spy = vi.spyOn(gateway, "exchangeCodeForTokens");
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      "5511984444444",
    );

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");

    expect(spy).toHaveBeenCalledWith("rightCode", "app");
  });

  test("refreshGoogleCredential", async () => {
    await orquestrator.clearDatabase();
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      "5511984444444",
    );

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
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

  test("handleGoogleLogin redirects unlinked users and closes linked challenges", async () => {
    await orquestrator.clearDatabase();

    const id1 = "5511984444444";
    const challenge1 = await createAppGoogleLoginChallenge(
      orquestrator.authService,
      id1,
    );
    let result = await orquestrator.authService.handleGoogleLogin(challenge1);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const user = await orquestrator.createUser();
    const challenge2 = await createAppGoogleLoginChallenge(
      orquestrator.authService,
      user.phoneNumber ?? "",
    );
    result = await orquestrator.authService.handleGoogleLogin(challenge2);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const id3 = "5511999888777";
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      id3,
    );
    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const challenge3 = await createAppGoogleLoginChallenge(
      orquestrator.authService,
      id3,
    );
    const refreshSpy = vi.spyOn(orquestrator.googleAuthGateway, "refreshToken");
    const syncSpy = vi.spyOn(
      orquestrator.identityChatCoordinator,
      "syncUserChatAddresses",
    );
    result = await orquestrator.authService.handleGoogleLogin(challenge3);
    expect(result.type).toBe("alreadySignedIn");
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    await expect(
      orquestrator.authService.handleGoogleLogin(challenge3),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    refreshSpy.mockRestore();
    syncSpy.mockRestore();
  });

  test("handleGoogleRedirect", async () => {
    await orquestrator.clearDatabase();

    const phoneNumber1 = "5511984444444";
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber1,
    );
    const result = await orquestrator.authService.handleGoogleRedirect(
      state,
      "rightCode",
    );
    expect(result.type).toBe("success");
    let users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();

    const phoneNumber2 = "5511987654321";
    const state2 = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber2,
    );
    await expect(
      orquestrator.authService.handleGoogleRedirect(state2, "wrongCode"),
    ).rejects.toThrow();

    await expect(
      orquestrator.authService.handleGoogleRedirect(state, "rightCode"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();
  });

  test("handleGoogleRedirect persists email for new user", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511984444444";
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber,
    );

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const users = await orquestrator.authService.getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.email).toBe("savegooglecredentials@example.com");
  });

  test("handleGoogleRedirect backfills email on an existing unlinked user", async () => {
    await orquestrator.clearDatabase();
    const id = "5511984444444";
    await orquestrator.authService.createUser(new User("Existing User", id));
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const user = await orquestrator.authService.getUserByPhoneNumber(id);
    expect(user?.email).toBe("savegooglecredentials@example.com");
  });

  test("handleGoogleRedirect rejects mismatched email for existing user", async () => {
    await orquestrator.clearDatabase();
    const id = "5511984444444";
    const user = new User("Irwin Arruda", id);
    user.email = "another@example.com";
    await orquestrator.authService.createUser(user);
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await expect(
      orquestrator.authService.handleGoogleRedirect(state, "rightCode"),
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
    const id = "5511999888777";
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
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
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      "5511999888777",
    );
    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const gateway = orquestrator.googleAuthGateway;
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

    const expiredJwt = new Jwt({
      ...orquestrator.jwtConfig,
      expiresIn: "0s",
    });
    const expiredToken = await expiredJwt.sign({
      userId: "expired-user-id",
      email: "expired@example.com",
      purpose: "web-auth",
    });
    await expect(
      orquestrator.authService.authenticateWebUser(expiredToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("authenticateWebUser rejects tokens with another purpose", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);
    const jwt = new Jwt(orquestrator.jwtConfig);
    const token = await jwt.sign({
      userId: user.id,
      email: user.email,
      purpose: "another-purpose",
    });

    await expect(
      orquestrator.authService.authenticateWebUser(token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("handleWebGoogleRedirect updates credentials for an eligible user", async () => {
    await orquestrator.clearDatabase();
    const id = "5511984444444";
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
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
    const id = "5511984444444";
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
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
    const id = "5511984444444";
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
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

  test("handleWebGoogleRedirect restores credentials for a matching email user", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "savegooglecredentials@example.com";
    await orquestrator.authService.createUser(user);

    const token =
      await orquestrator.authService.handleWebGoogleRedirect("rightCode");
    const authenticated =
      await orquestrator.authService.authenticateWebUser(token);

    const restoredUser =
      await orquestrator.authService.getUserByPhoneNumber("5511984444444");
    expect(authenticated.id).toBe(user.id);
    expect(restoredUser?.email).toBe("savegooglecredentials@example.com");
    expect(restoredUser?.googleCredential).toBeDefined();
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

  test("authenticateWebUser rejects inactive users", async () => {
    await orquestrator.clearDatabase();
    const user = new User("Irwin Arruda", "5511984444444");
    user.email = "user@example.com";
    await orquestrator.authService.createUser(user);
    const token = await orquestrator.authService.createWebToken(user);
    await orquestrator.database.sql`
      UPDATE users
      SET is_inactive = true
      WHERE id = ${user.id}
    `;

    await expect(
      orquestrator.authService.authenticateWebUser(token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("auth validation paths reject empty inputs and missing credentials", async () => {
    await expect(orquestrator.authService.getAppLoginUrl("")).rejects.toThrow(
      "Login provider ID is required",
    );
    await expect(
      orquestrator.authService.handleGoogleLogin(""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      orquestrator.authService.handleGoogleRedirect("", "rightCode"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const user = new User("Irwin Arruda", "5511984444444");
    await expect(
      orquestrator.authService.refreshGoogleCredential(user),
    ).rejects.toThrow("Something went wrong refreshing user credentials.");
  });

  test("handleGoogleRedirect creates user with email and BSUID when phone is absent", async () => {
    await orquestrator.clearDatabase();
    const bsuid = "BR.13491208655302741918";
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      bsuid,
    );

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    const user = await orquestrator.authService.getUserByBsuid(bsuid);
    expect(user?.email).toBe("savegooglecredentials@example.com");
    expect(user?.phoneNumber).toBeUndefined();
    expect(user?.bsuid).toBe(bsuid);
  });

  test("handleGoogleRedirect links an existing email user to the app BSUID", async () => {
    await orquestrator.clearDatabase();
    const bsuid = "BR.13491208655302741918";
    const email = "savegooglecredentials@example.com";
    const existingUser = new User("Existing User", undefined, email);
    await orquestrator.authService.createUser(existingUser);
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      bsuid,
    );

    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");

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
    const state = await createAppGoogleLoginState(orquestrator.authService, id);

    await expect(
      orquestrator.authService.handleGoogleRedirect(state, "rightCode"),
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

  test("deleteUserByChatChannelAddress deletes user by phone number", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511984444444";
    await orquestrator.createUser({ phoneNumber });
    const deleteChatSpy = vi
      .spyOn(orquestrator.identityChatCoordinator, "deleteChat")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(phoneNumber);
    expect(
      await orquestrator.authService.getUserByPhoneNumber(phoneNumber),
    ).toBeUndefined();
    expect(deleteChatSpy).toHaveBeenCalledWith(phoneNumber);
    deleteChatSpy.mockRestore();
  });

  test("deleteUserByChatChannelAddress deletes user by BSUID", async () => {
    await orquestrator.clearDatabase();
    const bsuid = "BR.13491208655302741918";
    const user = new User("BSUID User");
    user.bsuid = bsuid;
    await orquestrator.authService.createUser(user);
    const deleteChatSpy = vi
      .spyOn(orquestrator.identityChatCoordinator, "deleteChat")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(bsuid);
    expect(
      await orquestrator.authService.getUserByBsuid(bsuid),
    ).toBeUndefined();
    expect(deleteChatSpy).toHaveBeenCalledWith(bsuid);
    deleteChatSpy.mockRestore();
  });

  test("deleteUserByChatChannelAddress deletes user by email", async () => {
    await orquestrator.clearDatabase();
    const email = "delete-user@example.com";
    await orquestrator.createUser({ email });
    const deleteChatSpy = vi
      .spyOn(orquestrator.identityChatCoordinator, "deleteChat")
      .mockResolvedValue(undefined);
    await orquestrator.authService.deleteUserByChatChannelAddress(email);
    expect(
      await orquestrator.authService.getUserByEmail(email),
    ).toBeUndefined();
    expect(deleteChatSpy).toHaveBeenCalledWith(email);
    deleteChatSpy.mockRestore();
  });
});
