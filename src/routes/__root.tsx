import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { PrefsProvider, type Theme } from "~/components/PrefsProvider";
import { NotFoundPage } from "~/components/pages/PublicPages";
import { DEFAULT_LOCALE, getDictionary, isLocale, type Locale } from "~/i18n";

function parseCookies(header: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const idx = c.indexOf("=");
      if (idx === -1) return [c.trim(), ""];
      return [
        c.slice(0, idx).trim(),
        decodeURIComponent(c.slice(idx + 1).trim()),
      ];
    }),
  );
}

function resolvePrefs(cookieHeader: string): {
  locale: Locale;
  theme: Theme;
} {
  const cookies = parseCookies(cookieHeader);
  const locale: Locale = isLocale(cookies.locale)
    ? cookies.locale
    : DEFAULT_LOCALE;
  const theme: Theme = cookies.theme === "light" ? "light" : "dark";
  return { locale, theme };
}

const getPrefs = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return resolvePrefs(getRequestHeader("cookie") ?? "");
  })
  .client(() => resolvePrefs(document.cookie));

export const Route = createRootRoute({
  beforeLoad: async () => {
    return await getPrefs();
  },
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFoundRoute,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "The Chatbot" },
    ],
  }),
});

function RootComponent() {
  const { locale, theme } = Route.useRouteContext();
  return (
    <PrefsProvider initialLocale={locale} initialTheme={theme}>
      <Outlet />
    </PrefsProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { locale, theme } = Route.useRouteContext();
  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundRoute() {
  const { locale } = Route.useRouteContext();
  const dictionary = getDictionary(locale);
  return <NotFoundPage dictionary={dictionary} />;
}
