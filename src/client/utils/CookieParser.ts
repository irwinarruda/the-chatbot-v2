type CookieSameSite = "Strict" | "Lax" | "None";

type CookieOptions = {
  maxAge?: number;
  path?: string;
  sameSite?: CookieSameSite;
  secure?: boolean;
};

export class CookieParser {
  static parse(header: string): Record<string, string> {
    if (!header) return {};

    return Object.fromEntries(
      header.split(";").map((cookie) => {
        const idx = cookie.indexOf("=");
        if (idx === -1) return [cookie.trim(), ""];

        return [
          cookie.slice(0, idx).trim(),
          decodeURIComponent(cookie.slice(idx + 1).trim()),
        ];
      }),
    );
  }

  static set(name: string, value: string, options: CookieOptions = {}): void {
    if (typeof document === "undefined") return;

    const {
      maxAge,
      path = "/",
      sameSite = "Lax",
      secure = sameSite === "None",
    } = options;
    const attributes = [
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      `path=${path}`,
      maxAge === undefined ? undefined : `max-age=${maxAge}`,
      `SameSite=${sameSite}`,
      secure ? "Secure" : undefined,
    ].filter((attribute): attribute is string => attribute !== undefined);

    // biome-ignore lint/suspicious/noDocumentCookie: intentional client-side cookie write
    document.cookie = attributes.join(";");
  }

  static delete(name: string, options: Pick<CookieOptions, "path"> = {}): void {
    CookieParser.set(name, "", {
      maxAge: 0,
      path: options.path,
    });
  }
}
