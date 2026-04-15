import { Http } from "~/utils/Http";

describe("Http", () => {
  test("redirect preserves location when custom headers are provided", () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "web_auth_token=token; Path=/; HttpOnly");

    const response = Http.redirect("https://example.com/chat", { headers });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://example.com/chat");
    expect(response.headers.get("Set-Cookie")).toContain(
      "web_auth_token=token",
    );
  });
});
