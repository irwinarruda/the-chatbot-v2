import { describe, expect, test } from "vitest";
import { User } from "~/modules/identity/domain/User";
import { toCurrentUserResponse } from "~/modules/identity/server/IdentityContractMapper";

describe("Identity contracts", () => {
  test("real user serialization is accepted by the client contract", () => {
    const user = new User("Irwin", "5511999999999", "irwin@example.com");

    expect(toCurrentUserResponse(user)).toEqual(user.toJSON());
  });
});
