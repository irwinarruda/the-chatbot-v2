import type { User } from "~/domain/identity/user";
import { CurrentUserResponseDTO } from "./identity";

export function toCurrentUserResponse(user: User): CurrentUserResponseDTO {
  return CurrentUserResponseDTO.parse(user.toJSON());
}
