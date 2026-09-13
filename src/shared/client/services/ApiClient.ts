import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly action?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const body = ApiErrorResponseDTO.safeParse(await response.json());
    if (body.success) {
      return new ApiError(
        body.data.message,
        response.status,
        body.data.action,
        body.data.details,
      );
    }
  } catch {
    // Proxies can return HTML or an empty body instead of the API contract.
  }
  return new ApiError(
    `Request failed with ${response.status}`,
    response.status,
  );
}

export class ApiClient {
  private controller = new AbortController();
  onUnauthorized?: () => void;

  cancelPendingRequests() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  async request(url: string, options?: RequestInit): Promise<Response> {
    const { signal } = this.controller;
    const response = await fetch(url, { ...options, signal });
    signal.throwIfAborted();
    if (response.ok) return response;
    const error = await parseApiError(response);
    signal.throwIfAborted();
    if (response.status === 401) this.onUnauthorized?.();
    throw error;
  }
}

export const apiClient = new ApiClient();

export function clientError<T extends string>(error: unknown, fallback: T) {
  if (error instanceof ApiError) return error;
  return fallback;
}

export function clientErrorMessage<T extends string>(
  error: ApiError | T | undefined,
  messages: Record<T, string>,
) {
  if (error instanceof ApiError) return error.message;
  if (error) return messages[error];
  return undefined;
}
