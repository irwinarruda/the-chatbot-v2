import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ListTodo,
  MessageSquareText,
  NotebookText,
  PanelsTopLeft,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPrompt } from "~/client/shared/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
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
    <TerminalWindow
      title={t.windowTitle}
      activePath="/"
      dictionary={dictionary}
      mainClassName="items-stretch sm:items-start"
      windowClassName="flex flex-col"
      wide
    >
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <p className="mb-6 text-foreground text-sm leading-relaxed">
        <strong className="font-semibold text-foreground">{t.heading}</strong>{" "}
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
                className="group flex h-full flex-col rounded-lg border border-border/60 bg-muted/30 p-4 transition-all duration-300 hover:border-brand/40 hover:bg-muted/60"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  <h3 className="m-0 font-medium text-[0.9375rem] text-foreground transition-colors group-hover:text-primary">
                    {feature.title}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="ml-auto text-muted-foreground text-xs transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                  >
                    -&gt;
                  </span>
                </div>
                <p className="m-0 text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-info/20 bg-info/10 px-2 py-0.5 text-info text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <TerminalFooter className="mt-auto pt-6 sm:mt-0">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
