import { CurrentUserResponseDTO } from "~/modules/identity/entities/dtos/IdentityDTO";
import { apiClient } from "~/shared/client/services/ApiClient";

export function parseCurrentUser(data: unknown) {
  return CurrentUserResponseDTO.parse(data);
}

export const sessionService = {
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
