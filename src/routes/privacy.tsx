import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { usePrefs } from "~/components/PrefsProvider";
import { PrivacyPolicyPage } from "~/components/pages/PublicPages";
import { getDictionary, type Locale } from "~/i18n";

const loadPrivacyContent = createServerFn().handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { PostLoader } = await import("~/utils/PostLoader");
  const { isLocale, DEFAULT_LOCALE } = await import("~/i18n");
  const cookieHeader = getRequestHeader("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]*)/);
  const raw = match ? decodeURIComponent(match[1]) : "";
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return PostLoader.getPost("privacy-policy", locale);
});

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .privacyTitle,
      },
    ],
  }),
  loader: () => loadPrivacyContent(),
});

function PrivacyRoute() {
  const contentHtml = Route.useLoaderData();
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  return (
    <PrivacyPolicyPage dictionary={dictionary} contentHtml={contentHtml} />
  );
}
