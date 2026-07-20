import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { decodeJwt, jwtVerify, SignJWT } from "jose";

const skillDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultRoot = resolve(skillDirectory, "..", "..", "..");
const defaultProductionUrl = "https://the-chatbot.irwinarruda.com";
const webAuthTokenAudience = "the-chatbot-web";
const webAuthTokenIssuer = "the-chatbot";

function requireValue(values, key) {
  const value = values[key]?.trim();
  if (!value) {
    throw new Error(`${key} is missing from .env.production`);
  }
  return value;
}

async function loadProductionValues(root) {
  const baseEnvPath = resolve(root, ".env");
  const productionEnvPath = resolve(root, ".env.production");
  const baseValues = parse(await readFile(baseEnvPath));
  const productionValues = parse(await readFile(productionEnvPath));
  return { ...baseValues, ...productionValues };
}

function requireIdentity(payload) {
  if (typeof payload.userId !== "string" || !payload.userId) {
    throw new Error("PRODUCTION_WEB_AUTH_TOKEN has no userId");
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("PRODUCTION_WEB_AUTH_TOKEN has no email");
  }
  if (payload.purpose !== "web-auth") {
    throw new Error(
      "PRODUCTION_WEB_AUTH_TOKEN must use purpose web-auth; save a new __Host-web_auth_token value",
    );
  }
  if (payload.iss !== webAuthTokenIssuer) {
    throw new Error(
      "PRODUCTION_WEB_AUTH_TOKEN must use the current issuer; save a new __Host-web_auth_token value",
    );
  }
  if (payload.aud !== webAuthTokenAudience) {
    throw new Error(
      "PRODUCTION_WEB_AUTH_TOKEN must use the current audience; save a new __Host-web_auth_token value",
    );
  }
  const identity = {
    userId: payload.userId,
    email: payload.email,
    purpose: "web-auth",
  };
  if (typeof payload.phoneNumber === "string" && payload.phoneNumber) {
    identity.phoneNumber = payload.phoneNumber;
  }
  return identity;
}

async function refreshToken(savedToken, jwtSecret, expiresIn) {
  const decoded = decodeJwt(savedToken);
  requireIdentity(decoded);
  if (typeof decoded.iat !== "number") {
    throw new Error("PRODUCTION_WEB_AUTH_TOKEN has no issued-at timestamp");
  }
  const secret = new TextEncoder().encode(jwtSecret);
  const verificationDate = new Date(decoded.iat * 1_000);
  const verified = await jwtVerify(savedToken, secret, {
    algorithms: ["HS256"],
    issuer: webAuthTokenIssuer,
    audience: webAuthTokenAudience,
    currentDate: verificationDate,
  });
  const identity = requireIdentity(verified.payload);
  return new SignJWT(identity)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(webAuthTokenIssuer)
    .setAudience(webAuthTokenAudience)
    .setExpirationTime(expiresIn)
    .sign(secret);
}

function assertTokenIsActive(token) {
  const payload = decodeJwt(token);
  requireIdentity(payload);
  if (typeof payload.exp !== "number" || payload.exp <= Date.now() / 1_000) {
    throw new Error(
      "PRODUCTION_WEB_AUTH_TOKEN is expired and JWT_SECRET is not configured in .env.production",
    );
  }
  return token;
}

export async function createProductionWebAuthCookie(options = {}) {
  const root = options.root ?? defaultRoot;
  let values = options.values;
  if (!values) {
    values = await loadProductionValues(root);
  }
  const savedToken = requireValue(values, "PRODUCTION_WEB_AUTH_TOKEN");
  let token = savedToken;
  const jwtSecret = values.JWT_SECRET?.trim();
  if (jwtSecret) {
    const expiresIn = values.JWT_EXPIRES_IN?.trim() || "7d";
    token = await refreshToken(savedToken, jwtSecret, expiresIn);
  } else {
    token = assertTokenIsActive(savedToken);
  }
  const payload = decodeJwt(token);
  if (typeof payload.exp !== "number") {
    throw new Error("The production web auth token has no expiration");
  }
  const rawProductionUrl = values.PRODUCTION_URL || defaultProductionUrl;
  const productionUrl = new URL(rawProductionUrl);
  if (productionUrl.protocol !== "https:") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return {
    url: productionUrl.href,
    cookie: {
      name: "__Host-web_auth_token",
      value: token,
      url: new URL("/", productionUrl).href,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
      expires: payload.exp,
    },
  };
}
