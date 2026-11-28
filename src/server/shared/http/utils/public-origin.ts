export function getPublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto === "https" || forwardedProto === "http") {
    url.protocol = `${forwardedProto}:`;
  }
  return url.origin;
}
