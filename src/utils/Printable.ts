function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformToSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformToSnakeCase);
  if (obj instanceof Date) return obj;
  if (obj != null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toSnakeCase(key),
        transformToSnakeCase(value),
      ]),
    );
  }
  return obj;
}

export class Printable {
  static make<T>(data: T): string {
    const snakeCased = transformToSnakeCase(data);
    return JSON.stringify(
      snakeCased,
      null,
      process.env.NODE_ENV === "production" ? undefined : 2,
    );
  }

  static convert<T>(json: string): T {
    return JSON.parse(json) as T;
  }
}
