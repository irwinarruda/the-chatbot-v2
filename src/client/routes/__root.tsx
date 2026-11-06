import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { SessionBoundary } from "~/client/modules/identity/components/SessionBoundary";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/client/shared/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/client/shared/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/client/shared/components/terminal/TerminalPrompt";
import { TooltipProvider } from "~/client/shared/components/ui/tooltip";
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
    links: [{ rel: "stylesheet", href: tailwindHref }],
  }),
});

function RootDocument({ children }: { children: ReactNode }) {
  const prefs = Route.useRouteContext();
  const suppressHydrationWarning = import.meta.env.DEV;
  const hydratePrefs = useApp((state) => state.hydratePrefs);
  const hydrateMoneyPrivacy = useApp((state) => state.hydrateMoneyPrivacy);

  useEffect(() => {
    hydratePrefs(prefs);
    hydrateMoneyPrivacy();
  }, [hydrateMoneyPrivacy, hydratePrefs, prefs]);

  return (
    <html lang={prefs.locale} data-theme={prefs.theme}>
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
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <TerminalPanel centered>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter className="mt-auto pt-6">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </AppShell>
  );
}
