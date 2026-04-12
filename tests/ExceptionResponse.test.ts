import { ValidationException } from "@infra/exceptions";

describe("ExceptionResponse", () => {
  test("createApiErrorResponse serializes app errors into json responses", async () => {
    const exceptions = (await import("@infra/exceptions")) as Record<
      string,
      unknown
    >;
    const createApiErrorResponse = exceptions.createApiErrorResponse as
      | ((error: unknown) => Response)
      | undefined;

    expect(createApiErrorResponse).toBeTypeOf("function");

    const response = createApiErrorResponse?.(
      new ValidationException("Invalid request", "Fix the payload"),
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      message: "Invalid request",
      action: "Fix the payload",
      name: "ValidationException",
      statusCode: 400,
    });
  });
});
