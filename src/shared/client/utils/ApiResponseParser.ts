import type { z } from "zod";

function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

export function normalizeApiResponse(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(normalizeApiResponse);
  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        toCamelCase(key),
        normalizeApiResponse(value),
      ]),
    );
  }
  return data;
}

export function parseApiResponse<T extends z.ZodType>(
  contract: T,
  data: unknown,
): z.output<T> {
  return contract.parse(normalizeApiResponse(data));
}
