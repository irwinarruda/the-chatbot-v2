import { UnauthorizedException } from "@infra/exceptions";
import { verifyJwt } from "@infra/jwt";
import type { Config } from "./config";

export interface WebAuthPayload {
  userId: string;
  email: string;
  phoneNumber: string;
}

const COOKIE_NAME = "web_auth_token";

export async function requireWebAuth(
  request: Request,
  config: Config,
): Promise<WebAuthPayload> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = parseCookieValue(cookieHeader, COOKIE_NAME);
  if (!token) {
    throw new UnauthorizedException(
      "Authentication required",
      "Please log in to continue.",
    );
  }
  try {
    const payload = await verifyJwt<WebAuthPayload>(token, config.jwt.secret);
    if (!payload.userId || !payload.email || !payload.phoneNumber) {
      throw new UnauthorizedException(
        "Invalid authentication token",
        "Please log in again.",
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException(
      "Invalid or expired authentication token",
      "Please log in again.",
    );
  }
}

export function setAuthCookie(
  headers: Headers,
  token: string,
  secure = true,
): void {
  const maxAge = 7 * 24 * 60 * 60;
  const sameSite = secure ? "None" : "Lax";
  const securePart = secure ? "; Secure" : "";
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=${sameSite}${securePart}`,
  );
}

export function clearAuthCookie(headers: Headers): void {
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  );
}

function parseCookieValue(
  cookieHeader: string,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
