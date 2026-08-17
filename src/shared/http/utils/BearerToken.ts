import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";

export function requireBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (match?.[1]) return match[1];
  throw new UnauthorizedException(
    "A bearer token is required.",
    "Send the artifact upload token in the Authorization header.",
  );
}
