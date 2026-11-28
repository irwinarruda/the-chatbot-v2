import type {
  OAuthConsentDecision,
  OAuthConsentDecisionResponseDTO,
  OAuthConsentPromptResponseDTO,
} from "~/contracts/http/mcp/oauth";

export interface OAuthConsentRepository {
  getPrompt(authorizationQuery: string): Promise<OAuthConsentPromptResponseDTO>;
  decide(
    authorizationQuery: string,
    decision: OAuthConsentDecision,
  ): Promise<OAuthConsentDecisionResponseDTO>;
}
