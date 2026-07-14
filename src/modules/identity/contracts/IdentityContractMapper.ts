import { CurrentUserResponse } from "~/modules/identity/entities/dtos/IdentityDTO";
import type { User } from "~/modules/identity/entities/User";

export function toCurrentUserResponse(user: User): CurrentUserResponse {
  return CurrentUserResponse.parse(user.toJSON());
}
