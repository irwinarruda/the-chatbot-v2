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
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

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

  return (
    <AppShell title={t.windowTitle} activePath="/" dictionary={dictionary} wide>
      <TerminalPageHeader
        actions={
          <Button nativeButton={false} render={<Link to="/chat" />}>
            <MessageSquareText />
            {t.primaryAction}
          </Button>
        }
        heading={t.heading}
        subtitle={t.subtitle}
      />
      <HomeSummary />
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
                className="group flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-primary">
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
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
