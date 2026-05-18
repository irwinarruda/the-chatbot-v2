import { createFileRoute } from "@tanstack/react-router";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPrompt } from "~/client/components/TerminalPrompt";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { getDictionary } from "~/client/i18n";
import { useDictionary } from "~/client/providers/useDictionary";

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
    >
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <p className="mb-6 text-sm text-term-text leading-relaxed">
        <strong className="font-semibold text-term-bright">{t.heading}</strong>{" "}
        {t.description}
      </p>
      <ul className="mb-6 space-y-1">
        {t.features.map((feature) => (
          <li
            key={feature.title}
            className="relative py-2.5 pl-6 before:absolute before:left-1 before:font-mono before:font-semibold before:text-term-green before:content-['>']"
          >
            <h3 className="m-0 mb-0.5 font-medium text-[0.9375rem] text-term-bright">
              {feature.title}
            </h3>
            <p className="m-0 text-sm text-term-text leading-relaxed">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>
      <TerminalFooter className="mt-auto pt-6 sm:mt-0">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
