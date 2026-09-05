import { ZodError } from "zod";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";
import {
  AppError,
  type ApplicationFailure,
  InternalServerException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Printable } from "~/shared/utils/Printable";

export const ExceptionResponse = {
  handle(error: unknown): ApplicationFailure {
    if (error instanceof ValidationException) {
      return {
        message: error.message,
        action: error.action,
        name: error.name,
        statusCode: 400,
      };
    }
    if (error instanceof ZodError) {
      return {
        message: "The request contains invalid data.",
        action: "Correct the invalid fields and try again.",
        name: "ValidationException",
        statusCode: 400,
        details: {
          issues: error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.map(String),
          })),
        },
      };
    }
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        console.error("[InternalError]", error.message, error.cause ?? "");
      }
      return error.toResponse();
    }
    console.error("[UnhandledError]", error);
    const internalError = error instanceof Error ? error : undefined;
    return new InternalServerException(internalError).toResponse();
  },
};

export function createApiErrorResponse(error: unknown): Response {
  const response = ApiErrorResponseDTO.parse(ExceptionResponse.handle(error));
  return new Response(Printable.make(response), {
    status: response.statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
