import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ApiClient,
  ApiError,
  parseApiError,
} from "~/shared/client/services/ApiClient";
import { createDeferred } from "~/tests/utils/createDeferred";

afterEach(() => vi.unstubAllGlobals());

describe("ApiClient", () => {
  test("preserves server explanations and details with the real HTTP status", async () => {
    const response = Response.json(
      {
        message: "The note changed. Reload before saving.",
        action: "Reload the note",
        name: "Conflict",
        statusCode: 400,
        details: { note_id: "opaque-key" },
      },
      { status: 409 },
    );
    const error = await parseApiError(response);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 409,
      message: "The note changed. Reload before saving.",
      action: "Reload the note",
      details: { note_id: "opaque-key" },
    });
  });

  test.each(["<html>Bad gateway</html>", "", '{"unexpected":true}'])(
    "handles non-contract error bodies: %s",
    async (body) => {
      await expect(
        parseApiError(new Response(body, { status: 502 })),
      ).resolves.toMatchObject({
        statusCode: 502,
        message: "Request failed with 502",
      });
    },
  );

  test("expires the current session on unauthorized errors with empty bodies", async () => {
    const client = new ApiClient();
    client.onUnauthorized = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(client.request("/api/v1/web/notes")).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(client.onUnauthorized).toHaveBeenCalledOnce();
  });

  test("a cancelled session's late 401 cannot expire its replacement", async () => {
    const oldResponse = createDeferred<Response>();
    const client = new ApiClient();
    client.onUnauthorized = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(oldResponse.promise)
        .mockResolvedValueOnce(Response.json({ notes: [] })),
    );
    const oldRequest = client.request("/api/v1/web/notes");
    client.cancelPendingRequests();
    await expect(client.request("/api/v1/web/notes")).resolves.toBeInstanceOf(
      Response,
    );
    oldResponse.resolve(new Response(null, { status: 401 }));
    await expect(oldRequest).rejects.toMatchObject({ name: "AbortError" });
    expect(client.onUnauthorized).not.toHaveBeenCalled();
  });
});
