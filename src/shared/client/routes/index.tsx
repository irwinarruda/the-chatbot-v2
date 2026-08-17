import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ListTodo,
  MessageSquareText,
  NotebookText,
  PanelsTopLeft,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPrompt } from "~/shared/client/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { getDictionary } from "~/shared/client/i18n";
import { useDictionary } from "~/shared/client/providers/useDictionary";

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
      <p className="mb-6 text-sm text-term-text leading-relaxed">
        <strong className="font-semibold text-term-bright">{t.heading}</strong>{" "}
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
                className="group flex h-full flex-col rounded-lg border border-term-border/60 bg-term-chrome/30 p-4 transition-all duration-300 hover:border-term-green/30 hover:bg-term-chrome/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="size-4 text-term-green" aria-hidden="true" />
                  <h3 className="m-0 font-medium text-[0.9375rem] text-term-bright transition-colors group-hover:text-term-green">
                    {feature.title}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="ml-auto text-term-muted text-xs transition-transform group-hover:translate-x-0.5 group-hover:text-term-cyan motion-reduce:transition-none"
                  >
                    -&gt;
                  </span>
                </div>
                <p className="m-0 text-sm text-term-text leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-term-cyan/15 bg-term-cyan/8 px-2 py-0.5 text-term-cyan-strong text-xs"
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
