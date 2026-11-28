import { parseJsonRequest } from "./json-request";

export async function parseFormRequest(
  request: Request,
): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    const body = await parseJsonRequest(request, { maxBytes: 16_384 });
    return typeof body === "object" && body ? toStrings(body) : {};
  }
  const form = await request.formData();
  return toStrings(Object.fromEntries(form.entries()));
}

function toStrings(record: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
