import { createFileRoute, Link } from "@tanstack/react-router";
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
import { getDictionary } from "~/client/shared/i18n/dictionary";

const welcomeFeatures = [
  { href: "/chat", icon: MessageSquareText, key: "chat" },
  { href: "/todo", icon: ListTodo, key: "todos" },
  { href: "/notes", icon: NotebookText, key: "notes" },
  { href: "/artifacts", icon: PanelsTopLeft, key: "artifacts" },
  { href: "/cash-flow", icon: WalletCards, key: "cashFlow" },
  { href: "/bills", icon: ReceiptText, key: "bills" },
] as const;

export const Route = createFileRoute("/")({
  component: IndexRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary(match.context.locale).meta.welcomeTitle,
      },
    ],
  }),
});

function IndexRoute() {
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
        withLogo
      />
      <p className="mb-8 max-w-2xl text-pretty text-muted-foreground text-sm leading-relaxed">
        {t.description}
      </p>
      <ul className="mb-6 grid gap-3 sm:grid-cols-2">
        {welcomeFeatures.map((item) => {
          const feature = t.features[item.key];
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/40 hover:bg-muted/60"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand/12 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="m-0 font-medium text-foreground text-sm">
                    {feature.title}
                  </h3>
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                  />
                </div>
                <p className="m-0 text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
