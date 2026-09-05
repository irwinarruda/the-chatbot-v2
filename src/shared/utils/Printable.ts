function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformToSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformToSnakeCase);
  if (obj instanceof Date) return obj;
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        toSnakeCase(key),
        transformToSnakeCase(value),
      ]),
    );
  }
  return obj;
}

export class Printable {
  static make(data: unknown): string {
    const snakeCased = transformToSnakeCase(data);
    let indentation: number | undefined;
    if (process.env.NODE_ENV !== "production") indentation = 2;
    return JSON.stringify(snakeCased, undefined, indentation);
  }
}
