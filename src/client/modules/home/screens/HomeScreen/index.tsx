import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ListTodo,
  MessageSquareText,
  NotebookText,
  PanelsTopLeft,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { useApp } from "~/client/shared/stores/app";

import { HomeSummary } from "./HomeSummary";

const welcomeFeatures = [
  { href: "/chat", icon: MessageSquareText, key: "chat" },
  { href: "/todo", icon: ListTodo, key: "todos" },
  { href: "/notes", icon: NotebookText, key: "notes" },
  { href: "/artifacts", icon: PanelsTopLeft, key: "artifacts" },
  { href: "/cash-flow", icon: WalletCards, key: "cashFlow" },
  { href: "/bills", icon: ReceiptText, key: "bills" },
] as const;

export function HomeScreen() {
  const dictionary = useDictionary();
  const t = dictionary.welcomePage;
  const hasWebAccess = useApp((state) => state.hasWebAccess);
  const isSessionExpired = useApp((state) => state.isSessionExpired);
  const isLoggingOut = useApp((state) => state.isLoggingOut);
  const [hasAccess, setHasAccess] = useState(false);
  const isSignedIn = hasAccess && !isSessionExpired && !isLoggingOut;

  useEffect(() => {
    let isActive = true;
    hasWebAccess()
      .then((access) => {
        if (isActive) setHasAccess(access);
      })
      .catch(() => {
        if (isActive) setHasAccess(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <AppShell
      activePath="/"
      dictionary={dictionary}
      showLogout={isSignedIn}
      title={t.windowTitle}
    >
      <TerminalPageHeader
        primaryAction={{
          icon: MessageSquareText,
          label: t.primaryAction,
          link: <Link to="/chat" />,
          shouldKeepLabel: true,
        }}
        heading={t.heading}
        subtitle={t.subtitle}
      />
      <HomeSummary isSignedIn={isSignedIn} />
      {!isSignedIn && (
        <>
          <h2 className="mb-3 font-medium text-foreground text-sm">
            {t.areasLabel}
          </h2>
          <ul className="m-0 mb-6 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0">
            {welcomeFeatures.map((item) => {
              const feature = t.features[item.key];
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="group flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground text-sm">
                        {feature.title}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {feature.description}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AppShell>
  );
}
