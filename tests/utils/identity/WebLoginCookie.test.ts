import {
  createWebLoginState,
  getWebLoginRedirect,
  hasValidWebLoginState,
  setWebLoginCookies,
} from "~/shared/http/utils/WebLoginCookie";

describe("WebLoginCookie", () => {
  test("creates an unpredictable OAuth state value", () => {
    const firstState = createWebLoginState();
    const secondState = createWebLoginState();

    expect(firstState).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondState).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstState).not.toBe(secondState);
  });

  test("accepts only the state bound to the initiating browser", () => {
    const state = createWebLoginState();
    const request = new Request("https://the-chatbot.example/auth/callback", {
      headers: { cookie: `__Host-web_login_state=${state}` },
    });

    expect(hasValidWebLoginState(request, state)).toBe(true);
    expect(hasValidWebLoginState(request, createWebLoginState())).toBe(false);
    expect(hasValidWebLoginState(request, "invalid")).toBe(false);
  });

  test("stores secure short-lived login context and normalizes its redirect", () => {
    const headers = new Headers();
    const request = new Request("https://the-chatbot.example/auth/login");
    const state = createWebLoginState();

    setWebLoginCookies(
      headers,
      request,
      state,
      "https://attacker.example/notes",
    );

    const setCookie = headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`__Host-web_login_state=${state}`);
    expect(setCookie).toContain("__Host-web_login_redirect=%2Fchat");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=600");
  });

  test("reads only an internal protected redirect from the cookie", () => {
    const validRequest = new Request("https://the-chatbot.example/callback", {
      headers: {
        cookie: "__Host-web_login_redirect=%2Fnotes%2Fnote-id%3Fq%3Dplanning",
      },
    });
    const unsafeRequest = new Request("https://the-chatbot.example/callback", {
      headers: {
        cookie:
          "__Host-web_login_redirect=https%3A%2F%2Fattacker.example%2Fnotes",
      },
    });

    expect(getWebLoginRedirect(validRequest)).toBe("/notes/note-id?q=planning");
    expect(getWebLoginRedirect(unsafeRequest)).toBe("/chat");
  });

  test("rejects malformed cookie values without failing the callback", () => {
    const request = new Request("https://the-chatbot.example/callback", {
      headers: {
        cookie: "__Host-web_login_state=%; __Host-web_login_redirect=%E0%A4%A",
      },
    });

    expect(hasValidWebLoginState(request, createWebLoginState())).toBe(false);
    expect(getWebLoginRedirect(request)).toBe("/chat");
  });
});
