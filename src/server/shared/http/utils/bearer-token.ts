import { UnauthorizedException } from "~/server/shared/errors/application-errors";

export function readBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.match(/^Bearer ([^\s]+)$/i)?.[1];
}

export function requireBearerToken(request: Request): string {
  const token = readBearerToken(request);
  if (token) return token;
  throw new UnauthorizedException(
    "A bearer token is required.",
    "Send the artifact upload token in the Authorization header.",
  );
}
