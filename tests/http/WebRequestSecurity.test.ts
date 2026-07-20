import { describe, expect, test } from "vitest";
import {
  ForbiddenException,
  UnsupportedMediaTypeException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { requiresWebAuthentication } from "~/shared/http/middleware/auth";
import { enforceWebRequestSecurity } from "~/shared/http/middleware/webRequestSecurity";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";
import {
  deleteWebAuthCookie,
  getWebAuthToken,
  setWebAuthCookie,
} from "~/shared/http/utils/WebAuthCookie";

describe("web request security", () => {
  test("new web API routes require authentication by default", () => {
    expect(requiresWebAuthentication("/api/v1/status")).toBe(false);
    expect(requiresWebAuthentication("/api/v1/web/auth/login")).toBe(false);
    expect(requiresWebAuthentication("/api/v1/web/auth/logout")).toBe(false);
    expect(requiresWebAuthentication("/api/v1/web/auth/redirect")).toBe(false);
    expect(requiresWebAuthentication("/api/v1/web/auth/me")).toBe(true);
    expect(requiresWebAuthentication("/api/v1/web/notes")).toBe(true);
    expect(requiresWebAuthentication("/api/v1/web/notes/refine")).toBe(true);
    expect(requiresWebAuthentication("/api/v1/web/future-route")).toBe(true);
  });

  test("same-origin unsafe requests are accepted", () => {
    const request = new Request("https://app.example.com/api/v1/web/todos", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        Referer: "https://app.example.com/todo",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    expect(() => enforceWebRequestSecurity(request)).not.toThrow();
  });

  test("cross-site and originless unsafe requests are rejected", () => {
    const originless = new Request("https://app.example.com/api/v1/web/todos", {
      method: "POST",
    });
    const wrongOrigin = new Request(
      "https://app.example.com/api/v1/web/todos",
      {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      },
    );
    const crossSite = new Request("https://app.example.com/api/v1/web/todos", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    const wrongReferer = new Request(
      "https://app.example.com/api/v1/web/todos",
      {
        method: "POST",
        headers: {
          Origin: "https://app.example.com",
          Referer: "https://attacker.example/form",
        },
      },
    );

    expect(() => enforceWebRequestSecurity(originless)).toThrow(
      ForbiddenException,
    );
    expect(() => enforceWebRequestSecurity(wrongOrigin)).toThrow(
      ForbiddenException,
    );
    expect(() => enforceWebRequestSecurity(crossSite)).toThrow(
      ForbiddenException,
    );
    expect(() => enforceWebRequestSecurity(wrongReferer)).toThrow(
      ForbiddenException,
    );
  });

  test("safe methods and non-web routes do not require browser origin proof", () => {
    const safeWebRequest = new Request(
      "https://app.example.com/api/v1/web/todos",
    );
    const otherApiRequest = new Request(
      "https://app.example.com/api/v1/whatsapp/webhook",
      { method: "POST" },
    );

    expect(() => enforceWebRequestSecurity(safeWebRequest)).not.toThrow();
    expect(() => enforceWebRequestSecurity(otherApiRequest)).not.toThrow();
  });
});

describe("web JSON requests", () => {
  test("application/json with parameters is parsed", async () => {
    const request = new Request("https://app.example.com/api/v1/web/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "Secure request" }),
    });

    await expect(parseJsonRequest(request)).resolves.toEqual({
      name: "Secure request",
    });
  });

  test("non-JSON and malformed JSON requests are rejected", async () => {
    const textRequest = new Request(
      "https://app.example.com/api/v1/web/todos",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ name: "Forged request" }),
      },
    );
    const malformedRequest = new Request(
      "https://app.example.com/api/v1/web/todos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
    );
    const formRequest = new Request(
      "https://app.example.com/api/v1/web/todos",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "name=Forged+request",
      },
    );
    const missingContentTypeRequest = new Request(
      "https://app.example.com/api/v1/web/todos",
      { method: "POST" },
    );

    await expect(parseJsonRequest(textRequest)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    await expect(parseJsonRequest(formRequest)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    await expect(
      parseJsonRequest(missingContentTypeRequest),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(parseJsonRequest(malformedRequest)).rejects.toBeInstanceOf(
      ValidationException,
    );
  });
});

describe("web auth cookie", () => {
  test("HTTPS uses a hardened host-only cookie and ignores the non-prefixed name", () => {
    const request = new Request("https://app.example.com/api/v1/web/auth/me", {
      headers: {
        Cookie:
          "web_auth_token=local-name; __Host-web_auth_token=current-session",
      },
    });
    const headers = new Headers();

    setWebAuthCookie(headers, request, "new-session");

    const setCookie = headers.get("set-cookie") ?? "";
    expect(getWebAuthToken(request)).toBe("current-session");
    expect(setCookie).toContain("__Host-web_auth_token=new-session");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("SameSite=None");
    expect(setCookie).not.toContain("Domain=");
  });

  test("HTTP development uses the non-prefixed cookie without Secure", () => {
    const request = new Request("http://localhost:3000/api/v1/web/auth/me", {
      headers: { Cookie: "web_auth_token=local-session" },
    });
    const headers = new Headers();

    setWebAuthCookie(headers, request, "new-local-session");

    const setCookie = headers.get("set-cookie") ?? "";
    expect(getWebAuthToken(request)).toBe("local-session");
    expect(setCookie).toContain("web_auth_token=new-local-session");
    expect(setCookie).not.toContain("__Host-");
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  test("cookie deletion preserves production security attributes", () => {
    const request = new Request(
      "https://app.example.com/api/v1/web/auth/logout",
    );
    const headers = new Headers();

    deleteWebAuthCookie(headers, request);

    const setCookie = headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__Host-web_auth_token=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=Lax");
  });
});
