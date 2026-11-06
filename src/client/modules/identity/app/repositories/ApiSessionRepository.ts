import type { SessionRepository } from "~/client/modules/identity/app/repositories/SessionRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import { CurrentUserResponseDTO } from "~/contracts/http/identity/identity";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

export function parseCurrentUser(data: unknown) {
  return CurrentUserResponseDTO.parse(data);
}

export const apiSessionRepository: SessionRepository = {
  async hasWebAccess() {
    const access = await requireWebAccess();
    return access.ok;
  },
  async getCurrentUser() {
    const response = await apiClient.request("/api/v1/web/auth/me");
    return parseCurrentUser(await response.json());
  },
  async logout() {
    await apiClient.request("/api/v1/web/auth/logout", { method: "POST" });
  },
  cancelPendingRequests() {
    apiClient.cancelPendingRequests();
  },
};
