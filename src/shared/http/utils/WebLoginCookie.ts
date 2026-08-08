import { randomBytes, timingSafeEqual } from "node:crypto";
import { Cookie } from "~/infra/cookie";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";

const LOCAL_WEB_LOGIN_STATE_COOKIE_NAME = "web_login_state";
const SECURE_WEB_LOGIN_STATE_COOKIE_NAME = "__Host-web_login_state";
const LOCAL_WEB_LOGIN_REDIRECT_COOKIE_NAME = "web_login_redirect";
const SECURE_WEB_LOGIN_REDIRECT_COOKIE_NAME = "__Host-web_login_redirect";
const WEB_LOGIN_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const WEB_LOGIN_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createWebLoginState(): string {
  return randomBytes(32).toString("base64url");
}

export function setWebLoginCookies(
  headers: Headers,
  request: Request,
  state: string,
  redirectTo: string,
): void {
  const options = {
    maxAge: WEB_LOGIN_COOKIE_MAX_AGE_SECONDS,
    secure: isSecureRequest(request),
    sameSite: "Lax" as const,
  };
  Cookie.set(headers, webLoginStateCookieName(request), state, options);
  Cookie.set(
    headers,
    webLoginRedirectCookieName(request),
    encodeURIComponent(normalizeWebLoginRedirect(redirectTo)),
    options,
  );
}

export function deleteWebLoginCookies(
  headers: Headers,
  request: Request,
): void {
  const options = {
    secure: isSecureRequest(request),
    sameSite: "Lax" as const,
  };
  Cookie.delete(headers, webLoginStateCookieName(request), options);
  Cookie.delete(headers, webLoginRedirectCookieName(request), options);
}

export function getWebLoginRedirect(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return normalizeWebLoginRedirect(
    getCookieValue(cookieHeader, webLoginRedirectCookieName(request)),
  );
}

export function hasValidWebLoginState(
  request: Request,
  receivedState: string,
): boolean {
  if (!WEB_LOGIN_STATE_PATTERN.test(receivedState)) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = getCookieValue(
    cookieHeader,
    webLoginStateCookieName(request),
  );
  if (!expectedState || !WEB_LOGIN_STATE_PATTERN.test(expectedState)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(receivedState),
    Buffer.from(expectedState),
  );
}

function getCookieValue(
  cookieHeader: string,
  cookieName: string,
): string | undefined {
  try {
    return Cookie.get(cookieHeader, cookieName);
  } catch {
    return undefined;
  }
}

function webLoginStateCookieName(request: Request): string {
  if (isSecureRequest(request)) return SECURE_WEB_LOGIN_STATE_COOKIE_NAME;
  return LOCAL_WEB_LOGIN_STATE_COOKIE_NAME;
}

function webLoginRedirectCookieName(request: Request): string {
  if (isSecureRequest(request)) return SECURE_WEB_LOGIN_REDIRECT_COOKIE_NAME;
  return LOCAL_WEB_LOGIN_REDIRECT_COOKIE_NAME;
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
