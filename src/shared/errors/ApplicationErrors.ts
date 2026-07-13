export interface ApplicationFailure {
  message: string;
  action: string;
  name: string;
  statusCode: number;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly action: string,
    override readonly name: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }

  toResponse(): ApplicationFailure {
    return {
      message: this.message,
      action: this.action,
      name: this.name,
      statusCode: this.statusCode,
    };
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
