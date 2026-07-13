import { describe, expect, test } from "vitest";
import { parseCurrentUser } from "~/modules/chat/client/services/webChatService";
import { User } from "~/modules/identity/domain/User";
import { toCurrentUserResponse } from "~/modules/identity/server/IdentityContractMapper";
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
