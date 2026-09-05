import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { PostLoader } from "~/shared/http/utils/PostLoader";
import { resolvePrefs } from "~/shared/utils/PrefsUtils";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const cookieHeader = request.headers.get("cookie") ?? "";
    const prefs = resolvePrefs(cookieHeader);
    return PostLoader.getPost("privacy-policy", prefs.locale);
  },
);
