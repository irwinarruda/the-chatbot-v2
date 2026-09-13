import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import {
  applySecurityHeaders,
  createContentSecurityPolicy,
  SECURITY_HEADERS,
} from "~/shared/http/utils/SecurityHeaders";

const PRODUCTION_R2_PUBLIC_URL =
  "https://pub-d248037cf9bd470797f18fea2eb8ccbf.r2.dev/media";
const PREVIEW_R2_PUBLIC_URL =
  "https://pub-af2006400e044f4db50b3ee017dce171.r2.dev/media";

const VercelConfig = z.object({
  headers: z.array(
    z.object({
      source: z.string(),
      headers: z.array(
        z.object({
          key: z.string(),
          value: z.string(),
        }),
      ),
    }),
  ),
});

function parseCsp(policy: string) {
  return Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values];
    }),
  );
}

function loadVercelConfig() {
  const source = readFileSync(resolve("vercel.json"), "utf8");
  return VercelConfig.parse(JSON.parse(source));
}

describe("security headers", () => {
  test("applies the intended policy to an application response", () => {
    const headers = new Headers();

    applySecurityHeaders(headers, PRODUCTION_R2_PUBLIC_URL);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers.get(name)).toBe(value);
    }
    expect(headers.get("Content-Security-Policy")).toBe(
      createContentSecurityPolicy(PRODUCTION_R2_PUBLIC_URL),
    );
  });

  test("keeps executable and navigational CSP categories closed", () => {
    const directives = parseCsp(
      createContentSecurityPolicy(PRODUCTION_R2_PUBLIC_URL),
    );

    expect(directives["base-uri"]).toEqual(["'none'"]);
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["form-action"]).toEqual(["'self'"]);
    expect(directives["script-src"]).not.toContain("*");
    expect(directives["script-src"]).not.toContain("https:");
  });

  test.each([PRODUCTION_R2_PUBLIC_URL, PREVIEW_R2_PUBLIC_URL])(
    "allows only the configured R2 origin for %s",
    (r2PublicUrl) => {
      const directives = parseCsp(createContentSecurityPolicy(r2PublicUrl));
      const r2PublicOrigin = new URL(r2PublicUrl).origin;

      expect(directives["media-src"]).toEqual([
        "'self'",
        "blob:",
        r2PublicOrigin,
      ]);
      expect(directives["connect-src"]).toEqual(["'self'", r2PublicOrigin]);
    },
  );

  test("keeps static security headers at the Vercel edge", () => {
    const config = loadVercelConfig();
    const expectedHeaders = Object.entries(SECURITY_HEADERS).map(
      ([key, value]) => ({ key, value }),
    );

    expect(config.headers).toHaveLength(1);
    expect(config.headers[0]?.headers).toEqual(expectedHeaders);
    expect(
      config.headers[0]?.headers.some(
        ({ key }) => key === "Content-Security-Policy",
      ),
    ).toBe(false);
  });

  test.each(["/", "/chat", "/api/v1/status", "/missing"])(
    "covers %s at the deployment edge",
    (pathname) => {
      const config = loadVercelConfig();
      const source = config.headers[0]?.source;

      expect(source).toBeDefined();
      expect(pathname).toMatch(new RegExp(`^${source}$`));
    },
  );
});
