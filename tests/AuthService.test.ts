import { User } from "~/entities/User";
import { Encryption } from "~/infra/encryption";
import { GoogleAuthScopes } from "~/resources/GoogleAuthScopes";
import { orquestrator } from "./orquestrator";

describe("AuthService", () => {
  const authService = () => orquestrator.authService;

  test("getGoogleLoginUrl", () => {
    const phoneNumber = "5511984444444";
    const url = authService().getGoogleLoginUrl(phoneNumber);
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
    await authService().createUser(user);
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
    const users = await authService().getUsers();
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
      authService().saveUserByGoogleCredential(
        encryption.encrypt(phoneNumber),
        "wrongCode",
      ),
    ).rejects.toThrow();

    await authService().saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const users = await authService().getUsers();
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
      authService().saveUserByGoogleCredential(
        encryption.encrypt(phoneNumber),
        "rightCode",
      ),
    ).resolves.not.toThrow();
  });

  test("refreshGoogleCredential", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);

    await authService().saveUserByGoogleCredential(
      encryption.encrypt("5511984444444"),
      "rightCode",
    );
    const users = await authService().getUsers();
    expect(users[0]?.googleCredential?.accessToken).toBe(
      "ya29.a0ARrdaM9test_access_token_123456789",
    );
    expect(users[0]?.googleCredential?.refreshToken).toBe(
      "1//0G_refresh_token_test_abcdefghijklmnopqrstuvwxyz",
    );

    const refreshedUser = users[0];
    if (!refreshedUser) return;
    await authService().refreshGoogleCredential(refreshedUser);
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
    let result = await authService().handleGoogleLogin(phoneNumber1);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const user = await orquestrator.createUser();
    result = await authService().handleGoogleLogin(user.phoneNumber);
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") {
      expect(result.url).toContain("accounts.google.com");
    }

    const encryption = new Encryption(orquestrator.encryptionConfig);
    const phoneNumber3 = "5511999888777";
    await authService().saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber3),
      "rightCode",
    );
    result = await authService().handleGoogleLogin(phoneNumber3);
    expect(result.type).toBe("alreadySignedIn");
  });

  test("handleGoogleRedirect", async () => {
    await orquestrator.clearDatabase();
    const encryption = new Encryption(orquestrator.encryptionConfig);

    const phoneNumber1 = "5511984444444";
    const state = encryption.encrypt(phoneNumber1);
    let result = await authService().handleGoogleRedirect(state, "rightCode");
    expect(result.type).toBe("success");
    let users = await authService().getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();

    const phoneNumber2 = "5511987654321";
    const state2 = encryption.encrypt(phoneNumber2);
    await expect(
      authService().handleGoogleRedirect(state2, "wrongCode"),
    ).rejects.toThrow();

    result = await authService().handleGoogleRedirect(state, "rightCode");
    expect(result.type).toBe("success");
    users = await authService().getUsers();
    expect(users.length).toBe(1);
    expect(users[0]?.googleCredential).toBeDefined();
  });
});
