import { describe, expect, test } from "vitest";
import { parseCurrentUser } from "~/client/modules/identity/app/repositories/ApiSessionRepository";

import { toCurrentUserResponse } from "~/contracts/http/identity/identity-mapper";
import { User } from "~/domain/identity/user";

describe("Identity contracts", () => {
  test("serialized API users are mapped to the client contract", () => {
    const user = new User("Irwin", "5511999999999", "irwin@example.com");
    const response = toCurrentUserResponse(user);
    const wireResponse = JSON.parse(JSON.stringify(response));

    expect(wireResponse).toMatchObject({ phoneNumber: user.phoneNumber });
    expect(parseCurrentUser(wireResponse)).toEqual(response);
  });
});

describe("current user wire payload", () => {
  test("parses current user payloads into the shared user shape", () => {
    const user = parseCurrentUser({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Irwin",
      email: undefined,
      phoneNumber: "5511999999999",
    });

    expect(user).toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Irwin",
      email: undefined,
      phoneNumber: "5511999999999",
    });
  });
});
