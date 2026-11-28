import { z } from "zod";

export const MCP_PATH = "/api/v1/mcp";
export const OAUTH_AUTHORIZE_PATH = "/api/v1/oauth/authorize";
export const OAUTH_CONSENT_PAGE_PATH = "/oauth/authorize";
export const OAUTH_CONSENT_API_PATH = "/api/v1/web/oauth/authorize";
export const OAUTH_TOKEN_PATH = "/api/v1/oauth/token";
export const OAUTH_REGISTER_PATH = "/api/v1/oauth/register";
export const PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource";

export const OAuthErrorCode = {
  InvalidRequest: "invalid_request",
  InvalidClient: "invalid_client",
  InvalidGrant: "invalid_grant",
  UnsupportedGrantType: "unsupported_grant_type",
  InvalidRedirectUri: "invalid_redirect_uri",
  InvalidClientMetadata: "invalid_client_metadata",
  AccessDenied: "access_denied",
} as const;
export type OAuthErrorCode = ValueOf<typeof OAuthErrorCode>;

export const OAuthRedirectUriDTO = z
  .url()
  .max(2000)
  .refine(isAllowedRedirectUri, "Redirect URIs must use HTTPS or loopback");
export type OAuthRedirectUriDTO = z.infer<typeof OAuthRedirectUriDTO>;

export const OAuthClientRegistrationRequestDTO = z.object({
  redirect_uris: z.array(OAuthRedirectUriDTO).min(1).max(10),
  client_name: z.string().trim().min(1).max(200).optional(),
});
export type OAuthClientRegistrationRequestDTO = z.infer<
  typeof OAuthClientRegistrationRequestDTO
>;

export const OAuthClientRegistrationResponseDTO = z.object({
  client_id: z.string().uuid(),
  client_id_issued_at: z.number().int(),
  client_name: z.string().optional(),
  redirect_uris: z.array(z.string()),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  token_endpoint_auth_method: z.literal("none"),
});
export type OAuthClientRegistrationResponseDTO = z.infer<
  typeof OAuthClientRegistrationResponseDTO
>;

export const OAuthAuthorizationRequestDTO = z.object({
  response_type: z.literal("code"),
  client_id: z.string().uuid(),
  redirect_uri: OAuthRedirectUriDTO,
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1000).optional(),
  scope: z.string().max(1000).optional(),
  resource: z.string().max(2000).optional(),
});
export type OAuthAuthorizationRequestDTO = z.infer<
  typeof OAuthAuthorizationRequestDTO
>;

export const OAuthConsentDecision = z.enum(["approve", "deny"]);
export type OAuthConsentDecision = z.infer<typeof OAuthConsentDecision>;

export const OAuthAuthorizationDecisionDTO =
  OAuthAuthorizationRequestDTO.extend({
    decision: OAuthConsentDecision,
  });
export type OAuthAuthorizationDecisionDTO = z.infer<
  typeof OAuthAuthorizationDecisionDTO
>;

export const OAuthConsentPromptResponseDTO = z.object({
  clientName: z.string().optional(),
  redirectHost: z.string(),
  userEmail: z.string(),
});
export type OAuthConsentPromptResponseDTO = z.infer<
  typeof OAuthConsentPromptResponseDTO
>;

export const OAuthConsentDecisionResponseDTO = z.object({
  redirectUrl: z.string().min(1),
});
export type OAuthConsentDecisionResponseDTO = z.infer<
  typeof OAuthConsentDecisionResponseDTO
>;

export const OAuthTokenRequestDTO = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1).max(200),
    redirect_uri: z.string().min(1).max(2000).optional(),
    client_id: z.string().uuid(),
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(1).max(200),
    client_id: z.string().uuid(),
  }),
]);
export type OAuthTokenRequestDTO = z.infer<typeof OAuthTokenRequestDTO>;

export const OAuthTokenResponseDTO = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
});
export type OAuthTokenResponseDTO = z.infer<typeof OAuthTokenResponseDTO>;

export const OAuthErrorResponseDTO = z.object({
  error: z.enum(OAuthErrorCode),
  error_description: z.string().optional(),
});
export type OAuthErrorResponseDTO = z.infer<typeof OAuthErrorResponseDTO>;

export const ProtectedResourceMetadataResponseDTO = z.object({
  resource: z.url(),
  authorization_servers: z.array(z.url()),
  bearer_methods_supported: z.array(z.string()),
  resource_name: z.string(),
});
export type ProtectedResourceMetadataResponseDTO = z.infer<
  typeof ProtectedResourceMetadataResponseDTO
>;

export const AuthorizationServerMetadataResponseDTO = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  registration_endpoint: z.url(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
});
export type AuthorizationServerMetadataResponseDTO = z.infer<
  typeof AuthorizationServerMetadataResponseDTO
>;

function isAllowedRedirectUri(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return url.protocol === "http:" && isLoopback;
}
