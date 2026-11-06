import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { ArtifactList } from "./ArtifactList";
import { UploadTokenCard } from "./UploadTokenCard";

export function ArtifactsScreen() {
  const prefs = usePrefs();
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.artifactsPage;

  return (
    <AppShell
      activePath="/artifacts"
      dictionary={dictionary}
      showLogout
      title={t.windowTitle}
      wide
    >
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <ArtifactList />
      <UploadTokenCard />
    </AppShell>
  );
}
