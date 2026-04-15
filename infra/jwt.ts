import * as jose from "jose";
import type { JwtConfig } from "./config";

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
      .setExpirationTime(this.expiresIn)
      .sign(this.secret);
  }

  async verify<T>(token: string): Promise<T> {
    const { payload } = await jose.jwtVerify(token, this.secret);
    return payload as T;
  }
}
