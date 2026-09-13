import { Credential } from "~/modules/identity/entities/Credentials";

describe("Credential", () => {
  test("Credential constructor and update handle expiration with and without ttl", () => {
    const credential = new Credential(120);
    expect(credential.expirationDate).toBeInstanceOf(Date);

    credential.update("access", "refresh", 60);
    expect(credential.accessToken).toBe("access");
    expect(credential.refreshToken).toBe("refresh");
    expect(credential.expiresInSeconds).toBe(60);
    expect(credential.expirationDate).toBeInstanceOf(Date);

    credential.update("access-2", "refresh-2");
    expect(credential.expiresInSeconds).toBeUndefined();
    expect(credential.expirationDate).toBeUndefined();

    expect(credential.toJSON()).toMatchObject({
      id: credential.id,
      idUser: "",
      type: "google",
    });
  });
});
