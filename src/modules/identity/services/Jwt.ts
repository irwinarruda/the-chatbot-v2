import * as jose from "jose";
import type { JwtConfig } from "~/shared/config/Config";

const WEB_AUTH_TOKEN_AUDIENCE = "the-chatbot-web";
const WEB_AUTH_TOKEN_ISSUER = "the-chatbot";

export class Jwt {
  private secret: Uint8Array;
  private expiresIn: string;

  constructor(config: JwtConfig) {
    this.secret = new TextEncoder().encode(config.secret);
    this.expiresIn = config.expiresIn;
  }

  async sign(payload: Record<string, unknown>): Promise<string> {
    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(WEB_AUTH_TOKEN_ISSUER)
      .setAudience(WEB_AUTH_TOKEN_AUDIENCE)
      .setExpirationTime(this.expiresIn)
      .sign(this.secret);
  }

  async verify<T>(token: string): Promise<T> {
    const { payload } = await jose.jwtVerify(token, this.secret, {
      algorithms: ["HS256"],
      audience: WEB_AUTH_TOKEN_AUDIENCE,
      issuer: WEB_AUTH_TOKEN_ISSUER,
    });
    return payload as T;
  }
}
