import { createFileRoute } from "@tanstack/react-router";
import {
  isSupportedMcpProtocolVersion,
  JsonRpcErrorCode,
  JsonRpcRequestDTO,
} from "~/contracts/http/mcp/json-rpc";
import { toJsonRpcError } from "~/contracts/http/mcp/json-rpc-mapper";
import { toProtectedResourceMetadataUrl } from "~/contracts/http/mcp/oauth-mapper";
import { ARTIFACT_MAX_REQUEST_BYTES } from "~/domain/artifacts/artifact-limits";
import { getServer } from "~/server/production";
import { readBearerToken } from "~/server/shared/http/utils/bearer-token";
import { corsPreflight, withCors } from "~/server/shared/http/utils/cors";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";
import { getPublicOrigin } from "~/server/shared/http/utils/public-origin";

export const Route = createFileRoute("/api/v1/mcp")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => methodNotAllowed(),
      DELETE: () => methodNotAllowed(),
      async POST({ request }) {
        const { mcp, mcpOAuth } = getServer().services;
        const publicOrigin = getPublicOrigin(request);
        const token = readBearerToken(request);
        const idUser = token
          ? await mcpOAuth.findUserIdByAccessToken(token)
          : undefined;
        if (!idUser) return unauthorized(publicOrigin, Boolean(token));
        const version = request.headers.get("mcp-protocol-version");
        if (version && !isSupportedMcpProtocolVersion(version)) {
          return withCors(
            Http.json(
              toJsonRpcError(
                null,
                JsonRpcErrorCode.InvalidRequest,
                `Unsupported MCP-Protocol-Version: ${version}`,
              ),
              { status: 400 },
            ),
          );
        }
        const parsed = JsonRpcRequestDTO.safeParse(
          await parseJsonRequest(request, {
            maxBytes: ARTIFACT_MAX_REQUEST_BYTES,
          }),
        );
        if (!parsed.success) {
          return withCors(
            Http.json(
              toJsonRpcError(
                null,
                JsonRpcErrorCode.InvalidRequest,
                "Invalid JSON-RPC request",
              ),
              { status: 400 },
            ),
          );
        }
        const response = await mcp.handleMessage(parsed.data, {
          idUser,
          publicOrigin,
        });
        if (!response)
          return withCors(new Response(undefined, { status: 202 }));
        return withCors(Http.json(response));
      },
    },
  },
});

function unauthorized(publicOrigin: string, hasToken: boolean): Response {
  const challenge = [
    `Bearer resource_metadata="${toProtectedResourceMetadataUrl(publicOrigin)}"`,
    hasToken ? 'error="invalid_token"' : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const response = Http.json(
    { error: "invalid_token", error_description: "Sign in again." },
    { status: 401 },
  );
  response.headers.set("WWW-Authenticate", challenge);
  return withCors(response);
}

function methodNotAllowed(): Response {
  return withCors(
    new Response(undefined, {
      status: 405,
      headers: { Allow: "POST, OPTIONS" },
    }),
  );
}
