import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPanel } from "~/client/components/TerminalPanel";
import { TerminalPanelText } from "~/client/components/TerminalPanelText";
import { TerminalPrompt } from "~/client/components/TerminalPrompt";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import type { Prefs } from "~/client/entities/Prefs";
import { getDictionary } from "~/client/i18n";
import { DEFAULT_PREFS, prefsService } from "~/client/services/prefsService";
import { useApp } from "~/client/stores";
import tailwindHref from "~/client/styles/tailwind.css?url";

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
        content: "width=device-width, initial-scale=1",
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
  hydratePrefs(prefs);

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
