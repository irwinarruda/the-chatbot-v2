import { v4 as uuidv4 } from "uuid";
import {
  type OAuthAuthorizationRequestDTO,
  type OAuthClientRegistrationRequestDTO,
  OAuthErrorCode,
  type OAuthTokenRequestDTO,
} from "~/contracts/http/mcp/oauth";
import type { User } from "~/domain/identity/user";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type {
  McpOAuthClient,
  McpOAuthGrant,
  McpOAuthRepository,
} from "~/server/modules/mcp/repositories/mcp-oauth.repository";
import {
  createOAuthSecret,
  isPkceVerifierValid,
} from "~/server/modules/mcp/utils/oauth-pkce";
import { AppError } from "~/server/shared/errors/application-errors";

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class OAuthException extends AppError {
  constructor(
    readonly error: OAuthErrorCode,
    message: string,
  ) {
    super(message, "Start the connection again.", "OAuthException", 400);
  }
}

export interface McpAuthorizationPrompt {
  client: McpOAuthClient;
  user?: User;
}

export interface McpIssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export class McpOAuthService {
  constructor(
    private readonly oauth: McpOAuthRepository,
    private readonly auth: AuthService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async registerClient(
    dto: OAuthClientRegistrationRequestDTO,
  ): Promise<McpOAuthClient> {
    const client: McpOAuthClient = {
      id: uuidv4(),
      name: dto.client_name,
      redirectUris: dto.redirect_uris,
      createdAt: this.clock(),
    };
    await this.oauth.createClient(client);
    return client;
  }

  async prepareAuthorization(
    request: OAuthAuthorizationRequestDTO,
    webAuthToken?: string,
  ): Promise<McpAuthorizationPrompt> {
    const client = await this.requireClientRedirect(request);
    if (!webAuthToken) return { client };
    try {
      return {
        client,
        user: await this.auth.authenticateWebUser(webAuthToken),
      };
    } catch {
      return { client };
    }
  }

  async approveAuthorization(
    idUser: string,
    request: OAuthAuthorizationRequestDTO,
  ): Promise<string> {
    await this.requireClientRedirect(request);
    const code = createOAuthSecret("tcc_");
    const now = this.clock();
    await this.oauth.createCode(
      code,
      {
        idClient: request.client_id,
        idUser,
        redirectUri: request.redirect_uri,
        codeChallenge: request.code_challenge,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      },
      now,
    );
    return buildRedirect(request, { code });
  }

  async denyAuthorization(
    request: OAuthAuthorizationRequestDTO,
  ): Promise<string> {
    await this.requireClientRedirect(request);
    return buildRedirect(request, { error: OAuthErrorCode.AccessDenied });
  }

  async exchangeToken(dto: OAuthTokenRequestDTO): Promise<McpIssuedTokens> {
    if (dto.grant_type === "refresh_token") {
      const grant = await this.oauth.consumeRefreshToken(dto.refresh_token);
      this.requireLiveGrant(grant, dto.client_id);
      return this.issueTokens(dto.client_id, grant.idUser);
    }
    const code = await this.oauth.consumeCode(dto.code);
    this.requireLiveGrant(code, dto.client_id);
    if (dto.redirect_uri && dto.redirect_uri !== code.redirectUri) {
      throw new OAuthException(
        OAuthErrorCode.InvalidGrant,
        "The redirect URI does not match the authorization request.",
      );
    }
    if (!isPkceVerifierValid(dto.code_verifier, code.codeChallenge)) {
      throw new OAuthException(
        OAuthErrorCode.InvalidGrant,
        "The code verifier does not match the code challenge.",
      );
    }
    return this.issueTokens(dto.client_id, code.idUser);
  }

  async findUserIdByAccessToken(token: string): Promise<string | undefined> {
    const grant = await this.oauth.findAccessToken(token);
    if (!grant || grant.expiresAt <= this.clock()) return undefined;
    return grant.idUser;
  }

  private async issueTokens(
    idClient: string,
    idUser: string,
  ): Promise<McpIssuedTokens> {
    const now = this.clock();
    const accessToken = createOAuthSecret("tcm_");
    const refreshToken = createOAuthSecret("tcr_");
    await this.oauth.createTokenPair({
      idClient,
      idUser,
      accessToken,
      accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      refreshToken,
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      createdAt: now,
    });
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: ACCESS_TOKEN_TTL_MS / 1000,
    };
  }

  private requireLiveGrant<T extends McpOAuthGrant>(
    grant: T | undefined,
    idClient: string,
  ): asserts grant is T {
    if (!grant || grant.expiresAt <= this.clock()) {
      throw new OAuthException(
        OAuthErrorCode.InvalidGrant,
        "The grant is invalid, expired or already used.",
      );
    }
    if (grant.idClient !== idClient) {
      throw new OAuthException(
        OAuthErrorCode.InvalidGrant,
        "The grant was issued to another client.",
      );
    }
  }

  private async requireClientRedirect(
    request: OAuthAuthorizationRequestDTO,
  ): Promise<McpOAuthClient> {
    const client = await this.oauth.getClient(request.client_id);
    if (!client) {
      throw new OAuthException(
        OAuthErrorCode.InvalidClient,
        "This application is not registered. Remove the connector and add it again.",
      );
    }
    if (!client.redirectUris.includes(request.redirect_uri)) {
      throw new OAuthException(
        OAuthErrorCode.InvalidRequest,
        "The return address is not registered for this application.",
      );
    }
    return client;
  }
}

function buildRedirect(
  request: OAuthAuthorizationRequestDTO,
  params: Record<string, string>,
): string {
  const url = new URL(request.redirect_uri);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  if (request.state !== undefined) url.searchParams.set("state", request.state);
  return url.href;
}
