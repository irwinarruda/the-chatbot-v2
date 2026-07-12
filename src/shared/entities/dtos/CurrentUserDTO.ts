import type { User } from "~/shared/entities/User";

export type CurrentUserDTO = ReturnType<User["toJSON"]>;
