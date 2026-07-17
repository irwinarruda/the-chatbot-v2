import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SignJWT } from "jose";
import { Jwt } from "~/modules/identity/services/Jwt";

const JWT_SECRET = "production-browser-auth-test-secret";

interface ProductionBrowserAuthModule {
  createProductionWebAuthCookie(options: {
    values: Record<string, string>;
  }): Promise<ProductionBrowserAuthResult>;
}

interface ProductionBrowserAuthResult {
  url: string;
  cookie: {
    name: string;
    value: string;
    url: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
    expires: number;
  };
}

describe("production browser authentication", () => {
  test("refreshes an expired current-contract token into a production cookie", async () => {
    const helper = await loadProductionBrowserAuthModule();
    const savedToken = await createExpiredCurrentContractToken();

    const result = await helper.createProductionWebAuthCookie({
      values: {
        PRODUCTION_WEB_AUTH_TOKEN: savedToken,
        PRODUCTION_URL: "https://the-chatbot.example.com",
        JWT_SECRET,
        JWT_EXPIRES_IN: "7d",
      },
    });

    expect(result.url).toBe("https://the-chatbot.example.com/");
    expect(result.cookie).toMatchObject({
      name: "__Host-web_auth_token",
      url: "https://the-chatbot.example.com/",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
    expect(result.cookie).not.toHaveProperty("domain");
    const jwt = new Jwt({ secret: JWT_SECRET, expiresIn: "7d" });
    await expect(jwt.verify(result.cookie.value)).resolves.toMatchObject({
      userId: "production-user-id",
      email: "production@example.com",
      phoneNumber: "5511999999999",
      purpose: "web-auth",
      iss: "the-chatbot",
      aud: "the-chatbot-web",
    });
  });

  test("keeps a current active token when JWT_SECRET is unavailable", async () => {
    const helper = await loadProductionBrowserAuthModule();
    const jwt = new Jwt({ secret: JWT_SECRET, expiresIn: "7d" });
    const savedToken = await jwt.sign({
      userId: "production-user-id",
      email: "production@example.com",
      purpose: "web-auth",
    });

    const result = await helper.createProductionWebAuthCookie({
      values: {
        PRODUCTION_WEB_AUTH_TOKEN: savedToken,
        PRODUCTION_URL: "https://the-chatbot.example.com",
      },
    });

    expect(result.cookie.value).toBe(savedToken);
    expect(result.cookie.name).toBe("__Host-web_auth_token");
  });

  test("rejects a legacy saved token even when JWT_SECRET is available", async () => {
    const helper = await loadProductionBrowserAuthModule();
    const savedToken = await createLegacyToken();

    await expect(
      helper.createProductionWebAuthCookie({
        values: {
          PRODUCTION_WEB_AUTH_TOKEN: savedToken,
          PRODUCTION_URL: "https://the-chatbot.example.com",
          JWT_SECRET,
          JWT_EXPIRES_IN: "7d",
        },
      }),
    ).rejects.toThrow("must use purpose web-auth");
  });
});

async function loadProductionBrowserAuthModule(): Promise<ProductionBrowserAuthModule> {
  const moduleUrl = pathToFileURL(
    resolve(
      ".agents/skills/ship-production/scripts/create-browser-auth-cookie.mjs",
    ),
  );
  return (await import(moduleUrl.href)) as ProductionBrowserAuthModule;
}

async function createLegacyToken(): Promise<string> {
  return new SignJWT({
    userId: "production-user-id",
    email: "production@example.com",
    phoneNumber: "5511999999999",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

async function createExpiredCurrentContractToken(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000) - 60;
  return new SignJWT({
    userId: "production-user-id",
    email: "production@example.com",
    phoneNumber: "5511999999999",
    purpose: "web-auth",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setIssuer("the-chatbot")
    .setAudience("the-chatbot-web")
    .setExpirationTime(issuedAt + 1)
    .sign(new TextEncoder().encode(JWT_SECRET));
}
