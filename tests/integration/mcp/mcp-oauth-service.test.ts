import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import type { OAuthAuthorizationRequestDTO } from "~/contracts/http/mcp/oauth";
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

describe("McpOAuthService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
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
