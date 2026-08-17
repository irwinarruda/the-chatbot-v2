export const WEB_LOGIN_PATHS = [
  "/chat",
  "/todo",
  "/notes",
  "/artifacts",
  "/cash-flow",
  "/bills",
] as const;

export type WebLoginPath = (typeof WEB_LOGIN_PATHS)[number];

export const DEFAULT_WEB_LOGIN_REDIRECT: WebLoginPath = "/chat";

export function normalizeWebLoginRedirect(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_WEB_LOGIN_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_WEB_LOGIN_REDIRECT;
  }
  let url: URL;
  try {
    url = new URL(value, "https://the-chatbot.local");
  } catch {
    return DEFAULT_WEB_LOGIN_REDIRECT;
  }
  const allowedPath = WEB_LOGIN_PATHS.find(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
  );
  if (!allowedPath) return DEFAULT_WEB_LOGIN_REDIRECT;
  return `${url.pathname}${url.search}`;
}

export function getWebLoginActivePath(value: unknown): WebLoginPath {
  const redirectTo = normalizeWebLoginRedirect(value);
  const pathname = new URL(redirectTo, "https://the-chatbot.local").pathname;
  const activePath = WEB_LOGIN_PATHS.find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return activePath ?? DEFAULT_WEB_LOGIN_REDIRECT;
}
