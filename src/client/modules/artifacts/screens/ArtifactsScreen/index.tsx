import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { ArtifactList } from "./ArtifactList";
import { UploadTokenCard } from "./UploadTokenCard";

export function ArtifactsScreen() {
  const prefs = usePrefs();
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.artifactsPage;

  return (
    <TerminalWindow
      activePath="/artifacts"
      dictionary={dictionary}
      mainClassName="items-stretch sm:items-start"
      showLogout
      title={t.windowTitle}
      wide
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      <UploadTokenCard />
      <ArtifactList />
    </TerminalWindow>
  );
}
