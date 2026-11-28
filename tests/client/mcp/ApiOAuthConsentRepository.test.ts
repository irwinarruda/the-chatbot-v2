import { afterEach, describe, expect, test, vi } from "vitest";
import { apiOAuthConsentRepository } from "~/client/modules/mcp/app/repositories/ApiOAuthConsentRepository";

const query =
  "response_type=code&client_id=d8749e8c-57a9-4b9c-b6f7-392238f63312&state=1e3";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiOAuthConsentRepository", () => {
  test("asks the web API about the request with its query untouched", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        clientName: "Cursor",
        redirectHost: "cursor.com",
        userEmail: "irwin@example.com",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiOAuthConsentRepository.getPrompt(query)).resolves.toEqual({
      clientName: "Cursor",
      redirectHost: "cursor.com",
      userEmail: "irwin@example.com",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/v1/web/oauth/authorize?${query}`,
    );
  });

  test("posts the decision as JSON with every authorization field", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ redirectUrl: "https://cursor.com/cb?code=abc" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiOAuthConsentRepository.decide(query, "approve"),
    ).resolves.toEqual({ redirectUrl: "https://cursor.com/cb?code=abc" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/web/oauth/authorize");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      response_type: "code",
      client_id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
      state: "1e3",
      decision: "approve",
    });
  });
});
