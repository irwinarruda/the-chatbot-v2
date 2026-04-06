import { Printable } from "./Printable";

type Init = Omit<ResponseInit, "body" | "statusText">;

export class Http {
  static json(data: unknown, init?: Init): Response {
    if (data === null || data === undefined) {
      return new Response(null, { status: 204, ...init });
    }
    return new Response(Printable.make(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  }

  static text(data: string | null, init?: Init): Response {
    if (data === null) {
      return new Response(null, { status: 204, ...init });
    }
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
      ...init,
    });
  }
}
