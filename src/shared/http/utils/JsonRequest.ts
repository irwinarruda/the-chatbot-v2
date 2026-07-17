import { UnsupportedMediaTypeException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";

export async function parseJsonRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new UnsupportedMediaTypeException(
      "Content-Type must be application/json.",
      "Send the request as JSON and try again.",
    );
  }
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationException(
        "The request body contains malformed JSON.",
        "Correct the JSON body and try again.",
      );
    }
    throw error;
  }
}
