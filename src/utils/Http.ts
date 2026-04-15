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

  static redirect(url: string, init?: Init): Response {
    const headers = new Headers(init?.headers);
    headers.set("Location", url);
    const { headers: _headers, ...rest } = init ?? {};
    return new Response(null, {
      status: 302,
      headers,
      ...rest,
    });
  }
}
