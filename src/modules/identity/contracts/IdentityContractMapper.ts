import { CurrentUserResponseDTO } from "~/modules/identity/entities/dtos/IdentityDTO";
import type { User } from "~/modules/identity/entities/User";

export function toCurrentUserResponse(user: User): CurrentUserResponseDTO {
  return CurrentUserResponseDTO.parse(user.toJSON());
}
