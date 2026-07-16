import { describe, expect, test } from "vitest";
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
});
