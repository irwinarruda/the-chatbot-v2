export class Cookie {
  static get(cookieHeader: string, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(";")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === name) {
        return decodeURIComponent(part.slice(idx + 1).trim());
      }
    }
    return undefined;
  }

  static set(
    headers: Headers,
    name: string,
    value: string,
    options: CookieOptions = {},
  ): void {
    const parts = [
      `${name}=${value}`,
      "HttpOnly",
      `Path=${options.path ?? "/"}`,
    ];
    if (options.maxAge !== undefined) {
      parts.push(`Max-Age=${options.maxAge}`);
    }
    if (options.secure) {
      parts.push("Secure");
    }
    const sameSite = options.sameSite ?? "Lax";
    parts.push(`SameSite=${sameSite}`);
    headers.append("Set-Cookie", parts.join("; "));
  }

  static delete(headers: Headers, name: string, options?: CookieOptions): void {
    Cookie.set(headers, name, "", { ...options, maxAge: 0 });
  }
}

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}
