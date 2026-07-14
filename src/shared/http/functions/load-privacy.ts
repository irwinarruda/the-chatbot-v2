import { createServerFn } from "@tanstack/react-start";
import { PostLoader } from "~/shared/http/utils/PostLoader";
import { resolvePrefs } from "~/shared/utils/PrefsUtils";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async ({ request }: any) => {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const prefs = resolvePrefs(cookieHeader);
    return PostLoader.getPost("privacy-policy", prefs.locale);
  },
);
