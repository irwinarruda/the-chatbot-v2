import { describe, expect, test } from "vitest";
import { parseCurrentUser } from "~/modules/chat/client/services/webChatService";
import { toCurrentUserResponse } from "~/modules/identity/contracts/IdentityContractMapper";
import { User } from "~/modules/identity/entities/User";
import { Printable } from "~/shared/http/utils/Printable";

describe("Identity contracts", () => {
  test("serialized API users are mapped to the client contract", () => {
    const user = new User("Irwin", "5511999999999", "irwin@example.com");
    const response = toCurrentUserResponse(user);
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse).toMatchObject({ phone_number: user.phoneNumber });
    expect(parseCurrentUser(wireResponse)).toEqual(response);
  });
});
