import { hashOAuthSecret } from "~/server/modules/mcp/utils/oauth-pkce";
import type { DatabaseGateway } from "~/server/shared/database/database";

export interface McpOAuthClient {
  id: string;
  name?: string;
  redirectUris: string[];
  createdAt: Date;
}

export interface McpOAuthGrant {
  idClient: string;
  idUser: string;
  expiresAt: Date;
}

export interface McpOAuthCode extends McpOAuthGrant {
  redirectUri: string;
  codeChallenge: string;
}

export interface McpOAuthTokenPair {
  idClient: string;
  idUser: string;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
  createdAt: Date;
}

export class McpOAuthRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async createClient(client: McpOAuthClient): Promise<void> {
    await this.database.sql`
      INSERT INTO mcp_oauth_clients (id, name, redirect_uris, created_at)
      VALUES (
        ${client.id},
        ${client.name ?? null},
        ${client.redirectUris},
        ${client.createdAt}
      )
    `;
  }

  async getClient(id: string): Promise<McpOAuthClient | undefined> {
    const rows = await this.database.sql<DbMcpOAuthClient[]>`
      SELECT id, name, redirect_uris, created_at
      FROM mcp_oauth_clients
      WHERE id = ${id}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name ?? undefined,
      redirectUris: row.redirect_uris,
      createdAt: row.created_at,
    };
  }

  async createCode(
    code: string,
    grant: McpOAuthCode,
    createdAt: Date,
  ): Promise<void> {
    await this.database.sql`
      INSERT INTO mcp_oauth_codes (
        code_hash,
        id_client,
        id_user,
        redirect_uri,
        code_challenge,
        expires_at,
        created_at
      )
      VALUES (
        ${hashOAuthSecret(code)},
        ${grant.idClient},
        ${grant.idUser},
        ${grant.redirectUri},
        ${grant.codeChallenge},
        ${grant.expiresAt},
        ${createdAt}
      )
    `;
  }

  async consumeCode(code: string): Promise<McpOAuthCode | undefined> {
    const rows = await this.database.sql<DbMcpOAuthCode[]>`
      DELETE FROM mcp_oauth_codes
      WHERE code_hash = ${hashOAuthSecret(code)}
      RETURNING id_client, id_user, redirect_uri, code_challenge, expires_at
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      idClient: row.id_client,
      idUser: row.id_user,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      expiresAt: row.expires_at,
    };
  }

  async createTokenPair(pair: McpOAuthTokenPair): Promise<void> {
    await this.database.sql`
      INSERT INTO mcp_oauth_tokens (
        token_hash,
        kind,
        id_client,
        id_user,
        expires_at,
        created_at
      )
      VALUES
        (
          ${hashOAuthSecret(pair.accessToken)},
          'access',
          ${pair.idClient},
          ${pair.idUser},
          ${pair.accessExpiresAt},
          ${pair.createdAt}
        ),
        (
          ${hashOAuthSecret(pair.refreshToken)},
          'refresh',
          ${pair.idClient},
          ${pair.idUser},
          ${pair.refreshExpiresAt},
          ${pair.createdAt}
        )
    `;
  }

  async consumeRefreshToken(token: string): Promise<McpOAuthGrant | undefined> {
    const rows = await this.database.sql<DbMcpOAuthToken[]>`
      DELETE FROM mcp_oauth_tokens
      WHERE token_hash = ${hashOAuthSecret(token)} AND kind = 'refresh'
      RETURNING id_client, id_user, expires_at
    `;
    return toGrant(rows[0]);
  }

  async findAccessToken(token: string): Promise<McpOAuthGrant | undefined> {
    const rows = await this.database.sql<DbMcpOAuthToken[]>`
      SELECT id_client, id_user, expires_at
      FROM mcp_oauth_tokens
      WHERE token_hash = ${hashOAuthSecret(token)} AND kind = 'access'
    `;
    return toGrant(rows[0]);
  }
}

function toGrant(row?: DbMcpOAuthToken): McpOAuthGrant | undefined {
  if (!row) return undefined;
  return {
    idClient: row.id_client,
    idUser: row.id_user,
    expiresAt: row.expires_at,
  };
}

interface DbMcpOAuthClient {
  id: string;
  name: string | null;
  redirect_uris: string[];
  created_at: Date;
}

interface DbMcpOAuthCode {
  id_client: string;
  id_user: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: Date;
}

interface DbMcpOAuthToken {
  id_client: string;
  id_user: string;
  expires_at: Date;
}
