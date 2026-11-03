import { ApiError } from "~/client/shared/error/ApiError";

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
  }
}
