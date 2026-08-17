import { describe, expect, test } from "vitest";
import { z } from "zod";
import { parseApiResponse } from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { createApiErrorResponse } from "~/shared/http/utils/ApiErrorResponse";

describe("API error contract", () => {
  test("serialized API errors are snake case and map to the client contract", async () => {
    const response = createApiErrorResponse(
      new ValidationException("Invalid input"),
    );
    const wireResponse = await response.json();

    expect(wireResponse).toMatchObject({ status_code: 400 });
    expect(parseApiResponse(ApiErrorResponseDTO, wireResponse)).toMatchObject({
      message: "Invalid input",
      statusCode: 400,
    });
  });

  test("Zod request failures serialize as client validation errors", async () => {
    const error = z.object({ title: z.string() }).safeParse({ title: 1 }).error;
    const response = createApiErrorResponse(error);
    const wireResponse = await response.json();

    expect(response.status).toBe(400);
    expect(parseApiResponse(ApiErrorResponseDTO, wireResponse)).toMatchObject({
      name: "ValidationException",
      statusCode: 400,
      details: {
        issues: [
          expect.objectContaining({ code: "invalid_type", path: ["title"] }),
        ],
      },
    });
  });
});
