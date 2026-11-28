import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OAuthAuthorizationRequestDTO } from "~/contracts/http/mcp/oauth";
import { McpOAuthRepository } from "~/server/modules/mcp/repositories/mcp-oauth.repository";
import { OAuthException } from "~/server/modules/mcp/services/mcp-oauth.service";
import { orquestrator } from "~/tests/support/orchestrator";

const redirectUri = "https://grok.example/oauth/callback";

async function startAuthorization() {
  const oauth = orquestrator.mcpOAuthService;
  const user = await orquestrator.createUser();
  const client = await oauth.registerClient({
    client_name: "Grok",
    redirect_uris: [redirectUri],
  });
  const verifier = randomBytes(32).toString("base64url");
  const request: OAuthAuthorizationRequestDTO = {
    response_type: "code",
    client_id: client.id,
    redirect_uri: redirectUri,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state: "state-1",
  };
  const redirect = new URL(await oauth.approveAuthorization(user.id, request));
  return {
    oauth,
    user,
    client,
    verifier,
    request,
    redirect,
    code: redirect.searchParams.get("code") ?? "",
  };
}

async function connect() {
  const started = await startAuthorization();
  const tokens = await started.oauth.exchangeToken({
    grant_type: "authorization_code",
    code: started.code,
    client_id: started.client.id,
    code_verifier: started.verifier,
  });
  const refresh = (refreshToken: string) =>
    started.oauth.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: started.client.id,
    });
  return { ...started, tokens, refresh };
}

async function countTokens(): Promise<number> {
  const rows = await orquestrator.database.sql<
    { total: number }[]
  >`SELECT COUNT(*)::int AS total FROM mcp_oauth_tokens`;
  return rows[0]?.total ?? 0;
}

describe("McpOAuthService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("exchanges a PKCE code once and rotates refresh tokens", async () => {
    const { oauth, user, client, verifier, redirect, code } =
      await startAuthorization();
    expect(redirect.origin + redirect.pathname).toBe(redirectUri);
    expect(redirect.searchParams.get("state")).toBe("state-1");

    const exchange = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: client.id,
      code_verifier: verifier,
    } as const;
    const tokens = await oauth.exchangeToken(exchange);

    expect(tokens.expiresInSeconds).toBe(3600);
    expect(await oauth.findUserIdByAccessToken(tokens.accessToken)).toBe(
      user.id,
    );
    await expect(oauth.exchangeToken(exchange)).rejects.toThrow(OAuthException);

    const refresh = {
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: client.id,
    } as const;
    const rotated = await oauth.exchangeToken(refresh);

    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    expect(await oauth.findUserIdByAccessToken(rotated.accessToken)).toBe(
      user.id,
    );
    await expect(oauth.exchangeToken(refresh)).rejects.toThrow(OAuthException);
    expect(await oauth.findUserIdByAccessToken("tcm_unknown")).toBeUndefined();
  });

  test("revokes the whole family when a rotated refresh token is presented again", async () => {
    const { oauth, user, tokens, refresh } = await connect();
    const rotated = await refresh(tokens.refreshToken);
    expect(await oauth.findUserIdByAccessToken(rotated.accessToken)).toBe(
      user.id,
    );

    await expect(refresh(tokens.refreshToken)).rejects.toThrow(OAuthException);

    expect(await oauth.findUserIdByAccessToken(rotated.accessToken)).toBe(
      undefined,
    );
    expect(await oauth.findUserIdByAccessToken(tokens.accessToken)).toBe(
      undefined,
    );
    await expect(refresh(rotated.refreshToken)).rejects.toThrow(OAuthException);
    expect(await countTokens()).toBe(0);
  });

  test("leaves other connections of the same client and user untouched", async () => {
    const first = await connect();
    const second = await first.oauth.exchangeToken({
      grant_type: "authorization_code",
      code: new URL(
        await first.oauth.approveAuthorization(first.user.id, first.request),
      ).searchParams.get("code") as string,
      client_id: first.client.id,
      code_verifier: first.verifier,
    });
    const rotated = await first.refresh(first.tokens.refreshToken);

    await expect(first.refresh(first.tokens.refreshToken)).rejects.toThrow(
      OAuthException,
    );

    expect(await first.oauth.findUserIdByAccessToken(second.accessToken)).toBe(
      first.user.id,
    );
    expect(
      (await first.refresh(second.refreshToken)).refreshToken,
    ).toBeTruthy();
    expect(
      await first.oauth.findUserIdByAccessToken(rotated.accessToken),
    ).toBeUndefined();
  });

  test("does not reveal whether a refresh token was used or never existed", async () => {
    const { tokens, refresh } = await connect();
    await refresh(tokens.refreshToken);

    const used = await refresh(tokens.refreshToken).catch((error) => error);
    const unknown = await refresh("tcr_unknown").catch((error) => error);

    expect(used).toBeInstanceOf(OAuthException);
    expect(unknown).toBeInstanceOf(OAuthException);
    expect(used.message).toBe(unknown.message);
  });

  test("lets only one of two concurrent refreshes through and revokes the family", async () => {
    const { oauth, tokens, refresh } = await connect();

    const results = await Promise.allSettled([
      refresh(tokens.refreshToken),
      refresh(tokens.refreshToken),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const winner = results.find((r) => r.status === "fulfilled");
    expect(
      await oauth.findUserIdByAccessToken(
        winner?.status === "fulfilled" ? winner.value.accessToken : "",
      ),
    ).toBeUndefined();
    expect(await countTokens()).toBe(0);
  });

  test("revokes the family even when the newest token rotates at the moment an old one is replayed", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await orquestrator.clearDatabase();
      const { tokens, refresh } = await connect();
      const newest = await refresh(tokens.refreshToken);

      const results = await Promise.allSettled([
        refresh(newest.refreshToken),
        refresh(tokens.refreshToken),
      ]);

      expect(results[1]?.status).toBe("rejected");
      expect(await countTokens()).toBe(0);
    }
  });

  test("keeps the old refresh token usable when issuing the new pair fails", async () => {
    const { oauth, user, tokens, refresh } = await connect();
    vi.spyOn(
      McpOAuthRepository.prototype,
      "createTokenPair",
    ).mockRejectedValueOnce(new Error("database unavailable"));

    await expect(refresh(tokens.refreshToken)).rejects.toThrow(
      "database unavailable",
    );

    const rotated = await refresh(tokens.refreshToken);
    expect(await oauth.findUserIdByAccessToken(rotated.accessToken)).toBe(
      user.id,
    );
  });

  test("does not burn the refresh token when another client presents it", async () => {
    const { oauth, user, tokens, refresh } = await connect();
    const other = await oauth.registerClient({ redirect_uris: [redirectUri] });

    await expect(
      oauth.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: other.id,
      }),
    ).rejects.toThrow("another client");

    const rotated = await refresh(tokens.refreshToken);
    expect(await oauth.findUserIdByAccessToken(rotated.accessToken)).toBe(
      user.id,
    );
  });

  test("drops expired tokens of the family when it rotates", async () => {
    const { tokens, refresh } = await connect();
    await orquestrator.database.sql`
      UPDATE mcp_oauth_tokens
      SET expires_at = NOW() - INTERVAL '1 minute'
      WHERE kind = 'access'
    `;

    await refresh(tokens.refreshToken);

    const access = await orquestrator.database.sql<
      { expires_at: Date }[]
    >`SELECT expires_at FROM mcp_oauth_tokens WHERE kind = 'access'`;
    expect(access).toHaveLength(1);
    expect(access[0]?.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  test("stores codes and tokens only as hashes", async () => {
    const { oauth, client, verifier, code } = await startAuthorization();
    const tokens = await oauth.exchangeToken({
      grant_type: "authorization_code",
      code,
      client_id: client.id,
      code_verifier: verifier,
    });

    const rows = await orquestrator.database.sql<
      { token_hash: Buffer; kind: string }[]
    >`SELECT token_hash, kind FROM mcp_oauth_tokens`;

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.token_hash).toHaveLength(32);
      expect(row.token_hash.toString("utf8")).not.toContain(tokens.accessToken);
    }
  });

  test("burns the code when the verifier is wrong", async () => {
    const { oauth, client, verifier, code } = await startAuthorization();
    const exchange = {
      grant_type: "authorization_code",
      code,
      client_id: client.id,
    } as const;

    await expect(
      oauth.exchangeToken({
        ...exchange,
        code_verifier: randomBytes(32).toString("base64url"),
      }),
    ).rejects.toThrow("code verifier");
    await expect(
      oauth.exchangeToken({ ...exchange, code_verifier: verifier }),
    ).rejects.toThrow(OAuthException);
  });

  test("refuses a code issued to another client", async () => {
    const { oauth, verifier, code } = await startAuthorization();
    const other = await oauth.registerClient({ redirect_uris: [redirectUri] });

    await expect(
      oauth.exchangeToken({
        grant_type: "authorization_code",
        code,
        client_id: other.id,
        code_verifier: verifier,
      }),
    ).rejects.toThrow("another client");
  });

  test("refuses unknown clients and unregistered return addresses", async () => {
    const { oauth, user, request } = await startAuthorization();

    await expect(
      oauth.prepareAuthorization({
        ...request,
        redirect_uri: "https://attacker.example/callback",
      }),
    ).rejects.toThrow(OAuthException);
    await expect(
      oauth.approveAuthorization(user.id, {
        ...request,
        client_id: "f1d4c2a4-1b55-4b8e-9b55-0c1b7a3c7f10",
      }),
    ).rejects.toThrow(OAuthException);
  });

  test("asks for sign-in without a web session and returns access_denied on deny", async () => {
    const { oauth, request } = await startAuthorization();

    const prompt = await oauth.prepareAuthorization(request, "not-a-jwt");
    const denied = new URL(await oauth.denyAuthorization(request));

    expect(prompt.user).toBeUndefined();
    expect(prompt.client.name).toBe("Grok");
    expect(denied.searchParams.get("error")).toBe("access_denied");
    expect(denied.searchParams.get("state")).toBe("state-1");
  });
});
