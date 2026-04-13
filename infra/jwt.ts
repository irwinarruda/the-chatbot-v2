import * as jose from "jose";

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: string,
): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedSecret);
}

export async function verifyJwt<T>(token: string, secret: string): Promise<T> {
  const encodedSecret = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, encodedSecret);
  return payload as T;
}
