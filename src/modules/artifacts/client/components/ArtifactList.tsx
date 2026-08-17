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
import { artifactService } from "~/modules/artifacts/client/services/artifactService";
import type { ArtifactDTO } from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";

type ArtifactListError = "loading" | "saving" | "deleting" | "copy";

export function ArtifactList() {
  const prefs = usePrefs();
  const [artifacts, setArtifacts] = useState<ArtifactDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ArtifactListError>();
  const t = getDictionary(prefs.locale).artifactsPage;
  let errorMessage: string | undefined;
  if (error === "loading") errorMessage = t.errorLoading;
  if (error === "saving") errorMessage = t.errorSaving;
  if (error === "deleting") errorMessage = t.errorDeleting;
  if (error === "copy") errorMessage = t.errorCopy;

  async function onShareLinkCopy(artifactId: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(`/a/${artifactId}`, window.location.origin).href,
      );
    } catch {
      setError("copy");
    }
  }

  async function onArtifactVisibilityToggle(artifact: ArtifactDTO) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(undefined);
    const visibility =
      artifact.visibility === ArtifactVisibility.Public
        ? ArtifactVisibility.Private
        : ArtifactVisibility.Public;
    try {
      const updated = await artifactService.changeVisibility(
        artifact.id,
        visibility,
      );
      setArtifacts((current) =>
        current.map((item) => {
          if (item.id === updated.id) return updated;
          return item;
        }),
      );
    } catch {
      setError("saving");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onArtifactDelete(artifact: ArtifactDTO) {
    if (isSubmitting || !window.confirm(t.deleteConfirmation)) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await artifactService.deleteArtifact(artifact.id);
      setArtifacts((current) =>
        current.filter((item) => item.id !== artifact.id),
      );
    } catch {
      setError("deleting");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;
    void artifactService
      .listArtifacts()
      .then((nextArtifacts) => {
        if (isCurrent) setArtifacts(nextArtifacts);
      })
      .catch(() => {
        if (isCurrent) setError("loading");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      {errorMessage && (
        <Alert
          className="mb-4 border-term-red/30 bg-term-red/10"
          variant="destructive"
        >
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="mb-2 flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide">
        <CodeXml className="size-3.5 text-term-green" />
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
                  className="gap-0 border-term-border border-l-2 bg-term-bg/40 py-0 shadow-none hover:border-l-term-green"
                  size="sm"
                >
                  <CardContent className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {isPublic ? (
                          <Globe2 className="size-4 shrink-0 text-term-green" />
                        ) : (
                          <LockKeyhole className="size-4 shrink-0 text-term-amber" />
                        )}
                        <Link
                          className="truncate font-semibold text-sm text-term-bright hover:text-term-green"
                          params={{ artifactId: artifact.id }}
                          to="/a/$artifactId"
                        >
                          {artifact.title}
                        </Link>
                        <Badge
                          className={
                            isPublic
                              ? "border-term-green/25 text-term-green"
                              : "border-term-amber/25 text-term-amber"
                          }
                          variant="outline"
                        >
                          {isPublic ? t.publicLabel : t.privateLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 mb-0 text-2xs text-term-muted">
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
        <div className="rounded-lg border border-term-border border-dashed bg-term-bg/40 p-8 text-center text-sm text-term-muted">
          {t.emptyState}
        </div>
      )}
    </>
  );
}
