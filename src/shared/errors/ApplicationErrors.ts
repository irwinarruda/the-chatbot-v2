import type { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

export type ApplicationFailure = ApiErrorResponseDTO;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly action: string,
    override readonly name: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  toResponse(): ApplicationFailure {
    const response: ApplicationFailure = {
      message: this.message,
      action: this.action,
      name: this.name,
      statusCode: this.statusCode,
    };
    if (this.details !== undefined) response.details = this.details;
    return response;
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

export class ConflictException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The resource changed before the operation completed.",
      action ?? "Refresh the resource and try again.",
      "ConflictException",
      409,
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

export class UnsupportedMediaTypeException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The request content type is not supported.",
      action ?? "Send the request with a supported content type.",
      "UnsupportedMediaTypeException",
      415,
    );
  }
}

export class PayloadTooLargeException extends AppError {
  constructor(message?: string, action?: string) {
    super(
      message ?? "The request body is too large.",
      action ?? "Reduce the request size and try again.",
      "PayloadTooLargeException",
      413,
    );
  }
}

export class InternalServerException extends AppError {
  constructor(cause?: Error, statusCode = 500) {
    super(
      "An unexpected internal error occurred.",
      "Please contact our support team for assistance.",
      "InternalServerException",
      statusCode,
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
