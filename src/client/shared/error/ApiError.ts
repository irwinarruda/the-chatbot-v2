import { ApiErrorResponseDTO } from "~/contracts/http/shared/api-error";

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
  const body = await readContractErrorBody(response);
  if (body?.success) {
    return new ApiError(
      body.data.message,
      response.status,
      body.data.action,
      body.data.details,
    );
  }
  return new ApiError(
    `Request failed with ${response.status}`,
    response.status,
  );
}

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

async function readContractErrorBody(response: Response) {
  try {
    return ApiErrorResponseDTO.safeParse(await response.json());
  } catch {
    return undefined;
  }
}
