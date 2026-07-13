import { CurrentUserResponse } from "~/modules/identity/contracts/IdentityContracts";
import type { User } from "~/modules/identity/domain/User";

export function toCurrentUserResponse(user: User): CurrentUserResponse {
  return CurrentUserResponse.parse(user.toJSON());
}
