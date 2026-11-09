import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { SessionBoundary } from "~/client/modules/identity/components/SessionBoundary";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Button } from "~/client/shared/components/ui/button";
import { TooltipProvider } from "~/client/shared/components/ui/tooltip";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import tailwindHref from "~/client/shared/styles/tailwind.css?url";
import {
  DEFAULT_PREFS,
  resolvePrefs,
} from "~/contracts/http/shared/prefs-cookie";

type PrefsRouteContext = {
  serverContext?: {
    prefs?: Prefs;
  };
};

function resolveRoutePrefs({ serverContext }: PrefsRouteContext): Prefs {
  if (serverContext?.prefs) return serverContext.prefs;
  if (typeof document !== "undefined") {
    return resolvePrefs(document.cookie);
  }
  return DEFAULT_PREFS;
}

export const Route = createRootRoute({
  beforeLoad: resolveRoutePrefs,
  shellComponent: RootDocument,
  notFoundComponent: NotFoundRoute,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "The Chatbot" },
    ],
    links: [
      { rel: "stylesheet", href: tailwindHref },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/svg+xml", href: "/brand/icon.svg" },
      { rel: "apple-touch-icon", href: "/brand/apple-touch-icon.png" },
    ],
  }),
});

function RootDocument({ children }: { children: ReactNode }) {
  const routePrefs = Route.useRouteContext();
  const prefs = usePrefs();
  const suppressHydrationWarning = import.meta.env.DEV;
  const hydratePrefs = useApp((state) => state.hydratePrefs);
  const hydrateMoneyPrivacy = useApp((state) => state.hydrateMoneyPrivacy);

  useEffect(() => {
    hydratePrefs(routePrefs);
    hydrateMoneyPrivacy();
  }, [hydrateMoneyPrivacy, hydratePrefs, routePrefs]);

  return (
    <html
      lang={prefs.locale}
      data-theme={prefs.theme}
      data-palette={prefs.palette}
    >
      <head>
        <HeadContent />
        <link
          rel="preload"
          href="/fonts/jetbrains-mono-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/ibm-plex-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body suppressHydrationWarning={suppressHydrationWarning}>
        <TooltipProvider delay={250}>
          <div className="isolate">
            <SessionBoundary>{children}</SessionBoundary>
          </div>
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundRoute() {
  const { locale } = Route.useRouteContext();
  const dictionary = getDictionary(locale);
  const t = dictionary.notFoundPage;
  return (
    <AppShell title={t.windowTitle} dictionary={dictionary}>
      <ListEmptyState
        actions={
          <Button nativeButton={false} render={<Link to="/" />}>
            {t.homeAction}
          </Button>
        }
        className="mt-12"
        description={t.body}
        icon={FileQuestion}
        title={t.subtitle}
      />
    </AppShell>
  );
}
