import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  CodeXml,
  LockKeyhole,
  Moon,
  Radio,
  Sun,
} from "lucide-react";
import { useEffect } from "react";
import { TerminalChromeButton } from "~/client/shared/components/terminal/TerminalChromeButton";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import { ArtifactFrame } from "./ArtifactFrame";

export function ArtifactViewerScreen({ artifactId }: { artifactId: string }) {
  const router = useRouter();
  const prefs = usePrefs();
  const toggleTheme = useApp((state) => state.toggleTheme);
  const toggleLocale = useApp((state) => state.toggleLocale);
  const artifact = useApp((state) => state.viewedArtifact);
  const hasError = useApp((state) => state.hasViewedArtifactError);
  const viewArtifact = useApp((state) => state.viewArtifact);
  const closeArtifact = useApp((state) => state.closeArtifact);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.artifactsPage;
  const themeLabel =
    prefs.theme === "light"
      ? dictionary.common.switchToDarkTheme
      : dictionary.common.switchToLightTheme;

  async function onToggleLocale() {
    await toggleLocale();
    router.invalidate();
  }

  useEffect(() => {
    void viewArtifact(artifactId);
    return closeArtifact;
  }, [artifactId]);

  return (
    <main className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-background">
      <a
        className="fixed top-3 left-3 z-60 -translate-y-24 rounded-md border border-brand/35 bg-card px-3 py-2 font-mono text-primary text-xs shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#artifact-content"
      >
        <span aria-hidden="true">$ </span>
        {dictionary.common.skipToContent}
      </a>
      <header className="sticky top-0 z-50 flex min-h-12 shrink-0 items-center gap-2 border-border border-b bg-muted/95 px-[max(0.75rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-sm sm:px-4">
        <CodeXml className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span
          className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm"
          title={artifact?.title ?? t.viewerWindowTitle}
        >
          {artifact?.title ?? t.viewerWindowTitle}
        </span>
        {artifact && (
          <>
            <span className="hidden shrink-0 text-2xs text-muted-foreground sm:inline">
              v{artifact.version}
            </span>
            <Badge
              className={
                artifact.visibility === ArtifactVisibility.Public
                  ? "shrink-0 border-info/25 bg-info/10 text-info"
                  : "shrink-0 border-border bg-muted text-muted-foreground"
              }
              variant="outline"
            >
              {artifact.visibility === ArtifactVisibility.Public ? (
                <Radio aria-hidden="true" />
              ) : (
                <LockKeyhole aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {artifact.visibility === ArtifactVisibility.Public
                  ? t.publicLabel
                  : t.privateLabel}
              </span>
            </Badge>
            <Button
              aria-label={t.manageAction}
              className="shrink-0"
              nativeButton={false}
              render={<Link to="/artifacts" />}
              size="xs"
              title={t.manageAction}
              variant="ghost"
            >
              <ArrowLeft />
              <span className="hidden sm:inline">{t.manageAction}</span>
            </Button>
          </>
        )}
        <TerminalChromeButton onClick={onToggleLocale} title={prefs.locale}>
          {prefs.locale === "pt-BR" ? "PT" : "EN"}
        </TerminalChromeButton>
        <TerminalChromeButton onClick={toggleTheme} title={themeLabel}>
          {prefs.theme === "light" ? (
            <Sun className="size-3" />
          ) : (
            <Moon className="size-3" />
          )}
        </TerminalChromeButton>
      </header>
      <section
        className="flex min-h-0 flex-1"
        id="artifact-content"
        tabIndex={-1}
      >
        {artifact ? (
          <ArtifactFrame html={artifact.renderedHtml} title={artifact.title} />
        ) : hasError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <Alert className="max-w-lg" variant="destructive">
              <AlertDescription>{t.viewerError}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <div
            aria-busy="true"
            aria-live="polite"
            className="flex flex-1 flex-col gap-3 p-4 sm:p-6"
          >
            <span className="sr-only">{t.loading}</span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="min-h-[65dvh] w-full flex-1" />
          </div>
        )}
      </section>
    </main>
  );
}
