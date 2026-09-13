export class Printable {
  static make(data: unknown): string {
    let indentation: number | undefined;
    if (process.env.NODE_ENV !== "production") indentation = 2;
    return JSON.stringify(data, undefined, indentation);
  }
}
