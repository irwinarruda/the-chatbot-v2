import { afterEach, describe, expect, test, vi } from "vitest";
import { ValidationException } from "~/infra/exceptions";

const getServiceMock = vi.hoisted(() => vi.fn());
const requireTuiGatewayMock = vi.hoisted(() => vi.fn());

vi.mock("~/infra/server-bootstrap", () => ({
  getService: getServiceMock,
  ensureBootstrapped: vi.fn(),
}));

vi.mock("~/infra/tui", () => ({
  requireTuiGateway: requireTuiGatewayMock,
}));

async function runApiMiddleware(options: {
  pathname: string;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { startInstance } = await import("~/start");
  const startOptions = await startInstance.getOptions();
  const middleware = startOptions.requestMiddleware?.[1]?.options.server;

  if (!middleware) {
    throw new Error("API exception middleware is not registered.");
  }

  return (await middleware({
    ...options,
    request: new Request(`http://localhost${options.pathname}`),
    context: {},
  } as never)) as Response;
}

describe("API exception middleware", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("serializes app errors for api paths", async () => {
    const response = await runApiMiddleware({
      pathname: "/api/v1/test",
      next: async () => {
        throw new ValidationException("Invalid request", "Fix the payload");
      },
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      message: "Invalid request",
      action: "Fix the payload",
      name: "ValidationException",
      statusCode: 400,
    });
  });

  test("rethrows non-api errors", async () => {
    const error = new ValidationException("Invalid page request", "Retry");

    await expect(
      runApiMiddleware({
        pathname: "/dashboard",
        next: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
  });

  test("serializes routed api validation failures with the shared payload", async () => {
    requireTuiGatewayMock.mockReturnValue({
      saveMediaAsync: vi.fn(),
    });
    getServiceMock.mockReturnValue({});

    const { Route } = await import("~/routes/api/v1/tui/audio");
    const handlers = (
      Route.options.server as {
        handlers: (options: { createHandlers: <T>(routeHandlers: T) => T }) => {
          POST: (options: { request: Request }) => Promise<Response>;
        };
      }
    ).handlers({
      createHandlers: <T>(routeHandlers: T): T => routeHandlers,
    });

    const response = await runApiMiddleware({
      pathname: "/api/v1/tui/audio",
      next: async () =>
        handlers.POST({
          request: new Request("http://localhost/api/v1/tui/audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone_number: "5511999999999",
              file_path: "relative/path.ogg",
            }),
          }),
        }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      message: "File path must be absolute (or start with ~/)",
      action: "Provide an absolute file path and try again.",
      name: "ValidationException",
      statusCode: 400,
    });
  });
});
