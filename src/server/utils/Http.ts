import { Printable } from "./Printable";

type Init = Omit<ResponseInit, "body" | "statusText">;

export class Http {
  static json(data: unknown, init?: Init): Response {
    if (data === undefined) {
      return new Response(undefined, { status: 204, ...init });
    }
    return new Response(Printable.make(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  }

  static text(data: string | undefined, init?: Init): Response {
    if (data === undefined) {
      return new Response(undefined, { status: 204, ...init });
    }
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
      ...init,
    });
  }

  static ok(init?: Init): Response {
    return new Response(undefined, { status: 200, ...init });
  }

  static stream(stream: ReadableStream, init?: Init): Response {
    return new Response(stream, { status: 200, ...init });
  }

  static redirect(url: string, init?: Init): Response {
    const headers = new Headers(init?.headers);
    headers.set("Location", url);
    const { headers: _headers, ...rest } = init ?? {};
    return new Response(undefined, {
      status: 302,
      headers,
      ...rest,
    });
  }
}
