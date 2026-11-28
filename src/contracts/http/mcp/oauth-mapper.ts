import {
  AuthorizationServerMetadataResponseDTO,
  MCP_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_REGISTER_PATH,
  OAUTH_TOKEN_PATH,
  OAuthClientRegistrationResponseDTO,
  type OAuthErrorCode,
  OAuthErrorResponseDTO,
  OAuthTokenResponseDTO,
  PROTECTED_RESOURCE_METADATA_PATH,
  ProtectedResourceMetadataResponseDTO,
} from "./oauth";

export function toProtectedResourceMetadataResponse(
  origin: string,
): ProtectedResourceMetadataResponseDTO {
  return ProtectedResourceMetadataResponseDTO.parse({
    resource: new URL(MCP_PATH, origin).href,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_name: "The Chatbot",
  });
}

export function toAuthorizationServerMetadataResponse(
  origin: string,
): AuthorizationServerMetadataResponseDTO {
  return AuthorizationServerMetadataResponseDTO.parse({
    issuer: origin,
    authorization_endpoint: new URL(OAUTH_AUTHORIZE_PATH, origin).href,
    token_endpoint: new URL(OAUTH_TOKEN_PATH, origin).href,
    registration_endpoint: new URL(OAUTH_REGISTER_PATH, origin).href,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}

export function toOAuthTokenResponse(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}): OAuthTokenResponseDTO {
  return OAuthTokenResponseDTO.parse({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.expiresInSeconds,
    refresh_token: tokens.refreshToken,
  });
}

export function toOAuthClientRegistrationResponse(client: {
  id: string;
  name?: string;
  redirectUris: string[];
  createdAt: Date;
}): OAuthClientRegistrationResponseDTO {
  return OAuthClientRegistrationResponseDTO.parse({
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}

export function toOAuthErrorResponse(
  error: OAuthErrorCode,
  description?: string,
): OAuthErrorResponseDTO {
  return OAuthErrorResponseDTO.parse({ error, error_description: description });
}

export function toProtectedResourceMetadataUrl(origin: string): string {
  return new URL(`${PROTECTED_RESOURCE_METADATA_PATH}${MCP_PATH}`, origin).href;
}
