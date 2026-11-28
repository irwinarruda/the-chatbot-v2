import type { OAuthConsentRepository } from "~/client/modules/mcp/app/repositories/OAuthConsentRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import {
  OAUTH_CONSENT_API_PATH,
  OAuthConsentDecisionResponseDTO,
  OAuthConsentPromptResponseDTO,
} from "~/contracts/http/mcp/oauth";

export const apiOAuthConsentRepository: OAuthConsentRepository = {
  async getPrompt(authorizationQuery) {
    const response = await apiClient.request(
      `${OAUTH_CONSENT_API_PATH}?${authorizationQuery}`,
    );
    return OAuthConsentPromptResponseDTO.parse(await response.json());
  },

  async decide(authorizationQuery, decision) {
    const response = await apiClient.request(OAUTH_CONSENT_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(new URLSearchParams(authorizationQuery)),
        decision,
      }),
    });
    return OAuthConsentDecisionResponseDTO.parse(await response.json());
  },
};
