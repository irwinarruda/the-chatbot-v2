import {
  DEFAULT_WEB_LOGIN_REDIRECT,
  getWebLoginActivePath,
  normalizeWebLoginRedirect,
} from "~/modules/identity/utils/WebLoginNavigation";

describe("WebLoginNavigation", () => {
  test("preserves protected app destinations", () => {
    expect(normalizeWebLoginRedirect("/notes/note-id?q=planning#draft")).toBe(
      "/notes/note-id?q=planning",
    );
    expect(normalizeWebLoginRedirect("/cash-flow?type=expense")).toBe(
      "/cash-flow?type=expense",
    );
    expect(normalizeWebLoginRedirect("/artifacts")).toBe("/artifacts");
  });

  test("rejects external, public, and lookalike destinations", () => {
    const rejectedDestinations = [
      "https://attacker.example/notes",
      "//attacker.example/notes",
      "/privacy",
      "/notes-archive",
      "javascript:alert(1)",
      undefined,
    ];

    for (const destination of rejectedDestinations) {
      expect(normalizeWebLoginRedirect(destination)).toBe(
        DEFAULT_WEB_LOGIN_REDIRECT,
      );
    }
  });

  test("derives navigation state from nested destinations", () => {
    expect(getWebLoginActivePath("/notes/note-id?q=planning")).toBe("/notes");
    expect(getWebLoginActivePath("/artifacts")).toBe("/artifacts");
    expect(getWebLoginActivePath("/bills?month=2026-08")).toBe("/bills");
  });
});
