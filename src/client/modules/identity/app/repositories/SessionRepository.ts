import type { CurrentUserDTO } from "~/contracts/http/identity/identity";

export interface SessionRepository {
  getCurrentUser(): Promise<CurrentUserDTO>;
  logout(): Promise<void>;
  cancelPendingRequests(): void;
}
