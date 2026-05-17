import { createServerFn } from "@tanstack/react-start";
import { prefsService } from "~/client/services/prefsService";
import { PostLoader } from "~/server/utils/PostLoader";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async ({ request }: any) => {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const prefs = prefsService.resolvePrefs(cookieHeader);
    return PostLoader.getPost("privacy-policy", prefs.locale);
  },
);
