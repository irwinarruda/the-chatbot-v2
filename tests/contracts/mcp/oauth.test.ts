import { describe, expect, test } from "vitest";
import {
  OAuthAuthorizationRequestDTO,
  OAuthClientRegistrationRequestDTO,
  OAuthTokenRequestDTO,
} from "~/contracts/http/mcp/oauth";
import {
  toAuthorizationServerMetadataResponse,
  toOAuthConsentDecisionResponse,
  toOAuthConsentPagePath,
  toOAuthConsentPromptResponse,
  toProtectedResourceMetadataResponse,
  toProtectedResourceMetadataUrl,
} from "~/contracts/http/mcp/oauth-mapper";

const authorization = {
  response_type: "code",
  client_id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
  redirect_uri: "https://grok.example/oauth/callback",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  state: "xyz",
};

describe("MCP OAuth contracts", () => {
  test("registers public clients with HTTPS or loopback redirect URIs", () => {
    expect(
      OAuthClientRegistrationRequestDTO.parse({
        client_name: "Grok",
        redirect_uris: [
          "https://grok.example/oauth/callback",
          "http://127.0.0.1:6274/callback",
        ],
        token_endpoint_auth_method: "none",
      }),
    ).toEqual({
      client_name: "Grok",
      redirect_uris: [
        "https://grok.example/oauth/callback",
        "http://127.0.0.1:6274/callback",
      ],
    });
    expect(() =>
      OAuthClientRegistrationRequestDTO.parse({
        redirect_uris: ["http://grok.example/callback"],
      }),
    ).toThrow();
    expect(() =>
      OAuthClientRegistrationRequestDTO.parse({ redirect_uris: ["not a url"] }),
    ).toThrow();
  });

  test("requires PKCE S256 on the authorization request", () => {
    expect(OAuthAuthorizationRequestDTO.parse(authorization)).toEqual(
      authorization,
    );
    expect(() =>
      OAuthAuthorizationRequestDTO.parse({
        ...authorization,
        code_challenge_method: "plain",
      }),
    ).toThrow();
  });

  test("accepts the two grant types and rejects others", () => {
    expect(
      OAuthTokenRequestDTO.parse({
        grant_type: "refresh_token",
        refresh_token: "tcr_abc",
        client_id: authorization.client_id,
      }).grant_type,
    ).toBe("refresh_token");
    expect(() =>
      OAuthTokenRequestDTO.parse({
        grant_type: "client_credentials",
        client_id: authorization.client_id,
      }),
    ).toThrow();
  });

  test("describes the MCP resource and its authorization server", () => {
    const origin = "https://chatbot.example";

    expect(toProtectedResourceMetadataResponse(origin)).toMatchObject({
      resource: "https://chatbot.example/api/v1/mcp",
      authorization_servers: [origin],
    });
    expect(toAuthorizationServerMetadataResponse(origin)).toMatchObject({
      issuer: origin,
      token_endpoint: "https://chatbot.example/api/v1/oauth/token",
      code_challenge_methods_supported: ["S256"],
    });
    expect(toProtectedResourceMetadataUrl(origin)).toBe(
      "https://chatbot.example/.well-known/oauth-protected-resource/api/v1/mcp",
    );
  });

  test("sends the authorization query to the consent page as one opaque value", () => {
    const query =
      "client_id=abc&state=1e3&redirect_uri=https%3A%2F%2Fgrok.example%2Fcb";
    const path = toOAuthConsentPagePath(query);
    const params = new URL(path, "https://chatbot.example").searchParams;

    expect(path.startsWith("/oauth/authorize?request=")).toBe(true);
    expect(params.get("request")).toBe(query);
  });

  test("describes the consent prompt and the decision for the web page", () => {
    expect(
      toOAuthConsentPromptResponse({
        clientName: "Cursor",
        redirectHost: "grok.example",
        userEmail: "irwin@example.com",
      }),
    ).toEqual({
      clientName: "Cursor",
      redirectHost: "grok.example",
      userEmail: "irwin@example.com",
    });
    expect(
      toOAuthConsentDecisionResponse("https://grok.example/cb?code=a"),
    ).toEqual({ redirectUrl: "https://grok.example/cb?code=a" });
  });
});
