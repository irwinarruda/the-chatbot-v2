import { Link } from "@tanstack/react-router";
import {
  CodeXml,
  Copy,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import {
  type ApiError,
  clientError,
  clientErrorMessage,
} from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { ArtifactDTO } from "~/contracts/http/artifacts/artifact";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

export function ArtifactList() {
  const prefs = usePrefs();
  const artifacts = useApp((state) => state.artifacts);
  const isLoading = useApp((state) => state.isArtifactsLoading);
  const isSubmitting = useApp((state) => state.isArtifactSubmitting);
  const artifactError = useApp((state) => state.artifactError);
  const loadArtifacts = useApp((state) => state.loadArtifacts);
  const toggleArtifactVisibility = useApp(
    (state) => state.toggleArtifactVisibility,
  );
  const deleteArtifact = useApp((state) => state.deleteArtifact);
  const [copyError, setCopyError] = useState<"copy" | ApiError>();
  const t = getDictionary(prefs.locale).artifactsPage;
  const errorMessage = clientErrorMessage(copyError ?? artifactError, {
    loading: t.errorLoading,
    saving: t.errorSaving,
    deleting: t.errorDeleting,
    copy: t.errorCopy,
  });

  async function onShareLinkCopy(artifactId: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(`/a/${artifactId}`, window.location.origin).href,
      );
    } catch (error) {
      setCopyError(clientError(error, "copy"));
    }
  }

  async function onArtifactVisibilityToggle(artifact: ArtifactDTO) {
    setCopyError(undefined);
    await toggleArtifactVisibility(artifact);
  }

  async function onArtifactDelete(artifact: ArtifactDTO) {
    if (isSubmitting || !window.confirm(t.deleteConfirmation)) return;
    setCopyError(undefined);
    await deleteArtifact(artifact.id);
  }

  useEffect(() => {
    void loadArtifacts();
  }, []);

  return (
    <>
      {errorMessage && (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="mb-2 flex items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-wide">
        <CodeXml className="size-3.5 text-primary" />
        {t.listLabel}
      </div>
      {isLoading ? (
        <div aria-busy="true" aria-live="polite" className="space-y-2">
          <span className="sr-only">{t.loading}</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : artifacts.length > 0 ? (
        <ul aria-busy={isSubmitting} className="m-0 list-none space-y-2 p-0">
          {artifacts.map((artifact) => {
            const isPublic = artifact.visibility === ArtifactVisibility.Public;
            return (
              <li key={artifact.id}>
                <Card
                  className="gap-0 border-border border-l-2 bg-background/40 py-0 shadow-none hover:border-l-brand"
                  size="sm"
                >
                  <CardContent className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {isPublic ? (
                          <Globe2 className="size-4 shrink-0 text-info" />
                        ) : (
                          <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <Link
                          className="truncate font-semibold text-foreground text-sm hover:text-primary"
                          params={{ artifactId: artifact.id }}
                          to="/a/$artifactId"
                        >
                          {artifact.title}
                        </Link>
                        <Badge
                          className={
                            isPublic
                              ? "border-info/25 bg-info/10 text-info"
                              : "border-border bg-muted text-muted-foreground"
                          }
                          variant="outline"
                        >
                          {isPublic ? t.publicLabel : t.privateLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 mb-0 text-2xs text-muted-foreground">
                        v{artifact.version} ·{" "}
                        {new Date(artifact.updatedAt).toLocaleString(
                          prefs.locale,
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      <Button
                        aria-label={t.openAction}
                        nativeButton={false}
                        render={
                          <Link
                            params={{ artifactId: artifact.id }}
                            to="/a/$artifactId"
                          />
                        }
                        size="icon-sm"
                        title={t.openAction}
                        variant="ghost"
                      >
                        <ExternalLink />
                      </Button>
                      <Button
                        aria-label={t.copyLinkAction}
                        onClick={() => onShareLinkCopy(artifact.id)}
                        size="icon-sm"
                        title={t.copyLinkAction}
                        type="button"
                        variant="ghost"
                      >
                        <Copy />
                      </Button>
                      <Button
                        disabled={isSubmitting}
                        onClick={() => onArtifactVisibilityToggle(artifact)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {isPublic ? <LockKeyhole /> : <Globe2 />}
                        {isPublic ? t.makePrivateAction : t.makePublicAction}
                      </Button>
                      <Button
                        aria-label={t.deleteAction}
                        disabled={isSubmitting}
                        onClick={() => onArtifactDelete(artifact)}
                        size="icon-sm"
                        title={t.deleteAction}
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-border border-dashed bg-background/40 p-8 text-center text-muted-foreground text-sm">
          {t.emptyState}
        </div>
      )}
    </>
  );
}
