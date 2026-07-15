import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/shared/client/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";
import {
  DEFAULT_PREFS,
  prefsService,
} from "~/shared/client/services/prefsService";
import { useApp } from "~/shared/client/stores";
import tailwindHref from "~/shared/client/styles/tailwind.css?url";

type PrefsRouteContext = {
  serverContext?: {
    prefs?: Prefs;
  };
};

function resolveRoutePrefs({ serverContext }: PrefsRouteContext): Prefs {
  if (serverContext?.prefs) return serverContext.prefs;
  if (typeof document !== "undefined") {
    return prefsService.resolvePrefs(document.cookie);
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

  useEffect(() => {
    hydratePrefs(prefs);
  }, [hydratePrefs, prefs]);

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
      </head>
      <body suppressHydrationWarning={suppressHydrationWarning}>
        {children}
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
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <TerminalPanel>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter>
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
