import type { CurrentUserDTO } from "~/contracts/http/identity/identity";

export interface SessionRepository {
  hasWebAccess(): Promise<boolean>;
  getCurrentUser(): Promise<CurrentUserDTO>;
  logout(): Promise<void>;
  cancelPendingRequests(): void;
}
