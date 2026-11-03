export class DomainError extends Error {
  constructor(
    message: string,
    public readonly action = "Adjust the provided data and try again.",
  ) {
    super(message);
  }
}

export class ValidationException extends DomainError {
  constructor(
    message = "A validation error occurred.",
    action = "Adjust the provided data and try again.",
  ) {
    super(message, action);
    this.name = "ValidationException";
  }
}
