import { Cookie } from "~/infra/cookie";

const LOCAL_WEB_AUTH_COOKIE_NAME = "web_auth_token";
const SECURE_WEB_AUTH_COOKIE_NAME = "__Host-web_auth_token";
const WEB_AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function getWebAuthToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return Cookie.get(cookieHeader, webAuthCookieName(request));
}

export function setWebAuthCookie(
  headers: Headers,
  request: Request,
  token: string,
): void {
  Cookie.set(headers, webAuthCookieName(request), token, {
    maxAge: WEB_AUTH_COOKIE_MAX_AGE_SECONDS,
    secure: isSecureRequest(request),
    sameSite: "Lax",
  });
}

export function deleteWebAuthCookie(headers: Headers, request: Request): void {
  Cookie.delete(headers, webAuthCookieName(request), {
    secure: isSecureRequest(request),
    sameSite: "Lax",
  });
}

function webAuthCookieName(request: Request): string {
  if (isSecureRequest(request)) return SECURE_WEB_AUTH_COOKIE_NAME;
  return LOCAL_WEB_AUTH_COOKIE_NAME;
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
