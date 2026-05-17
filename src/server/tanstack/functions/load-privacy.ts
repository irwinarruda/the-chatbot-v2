import { createServerFn } from "@tanstack/react-start";
import { prefsService } from "~/client/services/prefsService";
import { PostLoader } from "~/server/utils/PostLoader";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const cookieHeader = getRequestHeader("cookie") ?? "";
    const prefs = prefsService.resolvePrefs(cookieHeader);
    return PostLoader.getPost("privacy-policy", prefs.locale);
  },
);
