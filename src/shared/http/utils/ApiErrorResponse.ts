import {
  AppError,
  type ApplicationFailure,
  InternalServerException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Printable } from "~/shared/http/utils/Printable";

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
  const response = ExceptionResponse.handle(error);
  return new Response(Printable.make(response), {
    status: response.statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
