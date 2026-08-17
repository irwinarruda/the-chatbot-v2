import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";

interface ParseJsonRequestOptions {
  maxBytes?: number;
}

export async function parseJsonRequest(
  request: Request,
  options: ParseJsonRequestOptions = {},
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new UnsupportedMediaTypeException(
      "Content-Type must be application/json.",
      "Send the request as JSON and try again.",
    );
  }
  try {
    if (!options.maxBytes) return await request.json();
    const body = await readBodyWithinLimit(request, options.maxBytes);
    return JSON.parse(body);
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

async function readBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw createPayloadTooLargeError(maxBytes);
    }
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw createPayloadTooLargeError(maxBytes);
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  return body + decoder.decode();
}

function createPayloadTooLargeError(maxBytes: number) {
  return new PayloadTooLargeException(
    `The request body must be at most ${maxBytes} bytes.`,
    "Reduce the request body and try again.",
  );
}
