import { ArtifactList } from "~/modules/artifacts/client/components/ArtifactList";
import { UploadTokenCard } from "~/modules/artifacts/client/components/UploadTokenCard";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";

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
