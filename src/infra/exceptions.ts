export interface ResponseException {
  message: string;
  action: string;
  name: string;
  statusCode: number;
}

function toResponse(error: AppError): ResponseException {
  return {
    message: error.message,
    action: error.action,
    name: error.name,
    statusCode: error.statusCode,
  };
}

export class AppError extends Error {
  action: string;
  override name: string;
  statusCode: number;

  constructor(
    message: string,
    action: string,
    name: string,
    statusCode: number,
  ) {
    super(message);
    this.action = action;
    this.name = name;
    this.statusCode = statusCode;
  }
}

export class ValidationException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "A validation error occurred.",
      action ?? "Adjust the provided data and try again.",
      "ValidationException",
      400,
    );
  }
}

export class ServiceException extends AppError {
  constructor(cause?: Error, message?: string) {
    super(
      message ?? "Service is currently unavailable.",
      "Check if the service is available and try again.",
      "ServiceException",
      503,
    );
    if (cause) this.cause = cause;
  }
}

export class NotFoundException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The resource was not found",
      action ?? "Change the filters and try again",
      "NotFoundException",
      404,
    );
  }
}

export class UnauthorizedException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The authentication data is invalid.",
      action ?? "Adjust the provided data and try again.",
      "UnauthorizedException",
      401,
    );
  }
}

export class ForbiddenException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "You are not allowed to use this functionality.",
      action ?? "Adjust the provided data and try again.",
      "ForbiddenException",
      403,
    );
  }
}

export class MethodNotAllowedException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The method is not allowed.",
      action ?? "Check the HTTP method for this endpoint.",
      "MethodNotAllowedException",
      405,
    );
  }
}

export class InternalServerException extends AppError {
  constructor(cause?: Error, statusCode?: number) {
    super(
      "An unexpected internal error occurred.",
      "Please contact our support team for assistance.",
      "InternalServerException",
      statusCode ?? 500,
    );
    if (cause) this.cause = cause;
  }
}

export class DeveloperException extends AppError {
  constructor(context: string, action?: string) {
    super(
      `${context} ${action ?? ""}`,
      action ?? "Please redo your last steps to debug the problem.",
      "DeveloperException",
      501,
    );
  }
}

export const ExceptionResponse = {
  handle(error: unknown): ResponseException {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        console.error("[InternalError]", error.message, error.cause ?? "");
      }
      return toResponse(error);
    }
    console.error("[UnhandledError]", error);
    const internalError = error instanceof Error ? error : undefined;
    return toResponse(new InternalServerException(internalError));
  },
};

export function createApiErrorResponse(error: unknown): Response {
  const response = ExceptionResponse.handle(error);
  return new Response(JSON.stringify(response), {
    status: response.statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
