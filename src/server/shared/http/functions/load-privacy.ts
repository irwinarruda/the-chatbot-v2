import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolvePrefs } from "~/contracts/http/shared/prefs-cookie";
import { PostLoader } from "~/server/shared/http/utils/post-loader";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const cookieHeader = request.headers.get("cookie") ?? "";
    const prefs = resolvePrefs(cookieHeader);
    return PostLoader.getPost("privacy-policy", prefs.locale);
  },
);
