import { Credential } from "~/modules/identity/entities/Credentials";
import { CredentialType } from "~/modules/identity/entities/enums/CredentialType";
import { User } from "~/modules/identity/entities/User";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("User", () => {
  test("User validates inputs, manages google credentials, and serializes", () => {
    expect(() => new User("x".repeat(30), "5511984444444")).toThrow(
      ValidationException,
    );
    expect(() => new User("Irwin", "123")).toThrow(ValidationException);

    const user: User = new User(
      "Irwin",
      "(55) 11 98444-4444",
      "user@example.com",
    );
    expect(user.phoneNumber).toBe("5511984444444");
    user.bsuid = "BR.13491208655302741918";
    expect(user.toJSON().bsuid).toBe("BR.13491208655302741918");

    const emailOnlyUser = new User("Irwin", undefined, "only@example.com");
    expect(emailOnlyUser.phoneNumber).toBeUndefined();
    expect(emailOnlyUser.email).toBe("only@example.com");

    user.updateEmail("updated@example.com");
    expect(user.email).toBe("updated@example.com");

    user.createGoogleCredential("access", "refresh", 3600);
    expect(user.googleCredential?.type).toBe(CredentialType.Google);
    expect(user.googleCredential?.expiresInSeconds).toBe(3600);

    const nonGoogleCredential = new Credential();
    nonGoogleCredential.type = "Other" as CredentialType;
    expect(() => user.addGoogleCredential(nonGoogleCredential)).toThrow(
      ValidationException,
    );

    const replacementCredential = new Credential();
    replacementCredential.type = CredentialType.Google;
    user.addGoogleCredential(replacementCredential);
    expect(user.googleCredential).toBe(replacementCredential);

    user.updateGoogleCredential("next-access", "next-refresh");
    expect(user.googleCredential?.accessToken).toBe("next-access");
    expect(user.googleCredential?.refreshToken).toBe("next-refresh");
    expect(user.googleCredential?.expirationDate).toBeUndefined();

    const userWithoutCredential = new User("Irwin", "5511984444444");
    expect(() =>
      userWithoutCredential.updateGoogleCredential("access", "refresh"),
    ).toThrow(ValidationException);

    expect(user.toJSON()).toMatchObject({
      name: "Irwin",
      email: "updated@example.com",
      phoneNumber: "5511984444444",
      bsuid: "BR.13491208655302741918",
    });
  });
});
