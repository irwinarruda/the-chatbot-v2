import { afterEach, describe, expect, test, vi } from "vitest";
import { UnauthorizedException } from "~/infra/exceptions";

const getServiceMock = vi.hoisted(() => vi.fn());

vi.mock("~/infra/server-bootstrap", () => ({
  ServerBootstrap: {
    getService: getServiceMock,
    ensureBootstrapped: vi.fn(),
  },
}));

describe("web auth redirect route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("redirects unregistered users to the not registered page", async () => {
    getServiceMock.mockReturnValue({
      handleWebLogin: vi
        .fn()
        .mockRejectedValue(
          new UnauthorizedException(
            "User not registered",
            "You need to register via WhatsApp first.",
          ),
        ),
    });

    const { Route } = await import("~/routes/api/v1/web/auth/redirect");
    const handlers = Route.options.server as {
      handlers: {
        GET: (options: { request: Request }) => Promise<Response>;
      };
    };

    const response = await handlers.handlers.GET({
      request: new Request(
        "https://example.com/api/v1/web/auth/redirect?code=rightCode",
      ),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://example.com/chat/not-registered",
    );
  });
});
