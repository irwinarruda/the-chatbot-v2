import { Link } from "@tanstack/react-router";
import {
  Check,
  Globe2,
  Link2,
  LockKeyhole,
  PanelsTopLeft,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "~/client/shared/components/ConfirmDialog";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
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
  const [copiedId, setCopiedId] = useState<string>();
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
      setCopiedId(artifactId);
      window.setTimeout(() => setCopiedId(undefined), 2000);
    } catch (error) {
      setCopyError(clientError(error, "copy"));
    }
  }

  async function onArtifactVisibilityToggle(artifact: ArtifactDTO) {
    setCopyError(undefined);
    await toggleArtifactVisibility(artifact);
  }

  async function onArtifactDelete(artifact: ArtifactDTO) {
    if (isSubmitting) return;
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
      <h2 className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm">
        {t.listLabel}
        {!isLoading && (
          <span className="font-normal text-muted-foreground">
            {artifacts.length}
          </span>
        )}
      </h2>
      {isLoading ? (
        <div aria-busy="true" aria-live="polite" className="space-y-2">
          <span className="sr-only">{t.loading}</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : artifacts.length > 0 ? (
        <ul
          aria-busy={isSubmitting}
          className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0"
        >
          {artifacts.map((artifact) => {
            const isPublic = artifact.visibility === ArtifactVisibility.Public;
            return (
              <li
                key={artifact.id}
                className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <PanelsTopLeft className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Link
                    className="block truncate font-medium text-foreground text-sm outline-none after:absolute after:inset-0 focus-visible:underline"
                    params={{ artifactId: artifact.id }}
                    to="/a/$artifactId"
                  >
                    {artifact.title}
                  </Link>
                  <p className="m-0 flex items-center gap-1.5 text-muted-foreground text-xs">
                    {isPublic ? (
                      <Globe2 className="size-3" />
                    ) : (
                      <LockKeyhole className="size-3" />
                    )}
                    <span>{isPublic ? t.publicLabel : t.privateLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>v{artifact.version}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={artifact.updatedAt}>
                      {new Date(artifact.updatedAt).toLocaleDateString(
                        prefs.locale,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </time>
                  </p>
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-1">
                  <Button
                    aria-label={t.copyLinkAction}
                    onClick={() => onShareLinkCopy(artifact.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground"
                  >
                    {copiedId === artifact.id ? (
                      <Check className="text-success" />
                    ) : (
                      <Link2 />
                    )}
                    <span className="hidden sm:inline" aria-live="polite">
                      {copiedId === artifact.id
                        ? t.copiedAction
                        : t.copyLinkAction}
                    </span>
                    <span className="sr-only sm:hidden">
                      {t.copyLinkAction}
                    </span>
                  </Button>
                  <Button
                    aria-label={
                      isPublic ? t.makePrivateAction : t.makePublicAction
                    }
                    disabled={isSubmitting}
                    onClick={() => onArtifactVisibilityToggle(artifact)}
                    size="sm"
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground"
                  >
                    {isPublic ? <LockKeyhole /> : <Globe2 />}
                    <span className="hidden sm:inline">
                      {isPublic ? t.makePrivateAction : t.makePublicAction}
                    </span>
                  </Button>
                  <ConfirmDialog
                    cancelLabel={t.cancelAction}
                    confirmLabel={t.deleteAction}
                    description={t.deleteConfirmation}
                    isDisabled={isSubmitting}
                    onConfirm={() => onArtifactDelete(artifact)}
                    title={t.deleteTitle.replace("{name}", artifact.title)}
                    trigger={
                      <Button
                        aria-label={t.deleteAction}
                        disabled={isSubmitting}
                        size="icon-sm"
                        title={t.deleteAction}
                        type="button"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ListEmptyState icon={PanelsTopLeft} title={t.emptyState} />
      )}
    </>
  );
}
