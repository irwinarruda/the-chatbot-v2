import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_LOCALE, isLocale } from "~/client/i18n";
import { PostLoader } from "~/server/utils/PostLoader";

export const loadPrivacyContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const cookieHeader = getRequestHeader("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]*)/);
    const raw = match ? decodeURIComponent(match[1]) : "";
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    return PostLoader.getPost("privacy-policy", locale);
  },
);
