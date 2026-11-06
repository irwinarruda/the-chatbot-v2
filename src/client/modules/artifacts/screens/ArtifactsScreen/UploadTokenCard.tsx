import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "~/client/shared/components/ConfirmDialog";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/client/shared/components/ui/card";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import {
  type ApiError,
  clientError,
  clientErrorMessage,
} from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

const ARTIFACT_SKILL_CONFIG_PATH =
  "~/.agents/skills/the-chatbot-artifact/config.json";

function createArtifactSkillConfig(artifactToken: string): string {
  let environment = "production";
  if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
    environment = "development";
  }
  return JSON.stringify(
    {
      version: 1,
      defaultEnvironment: environment,
      environments: {
        [environment]: {
          baseUrl: window.location.origin,
          artifactToken,
        },
      },
    },
    null,
    2,
  );
}

export function UploadTokenCard() {
  const prefs = usePrefs();
  const tokenStatus = useApp((state) => state.uploadTokenStatus);
  const revealedToken = useApp((state) => state.revealedUploadToken);
  const isSubmitting = useApp((state) => state.isUploadTokenSubmitting);
  const tokenError = useApp((state) => state.uploadTokenError);
  const loadUploadTokenStatus = useApp((state) => state.loadUploadTokenStatus);
  const hideUploadToken = useApp((state) => state.hideUploadToken);
  const rotateUploadToken = useApp((state) => state.rotateUploadToken);
  const revokeUploadToken = useApp((state) => state.revokeUploadToken);
  const [copyError, setCopyError] = useState<"copy" | ApiError>();
  const t = getDictionary(prefs.locale).artifactsPage;
  const revealedConfig = revealedToken
    ? createArtifactSkillConfig(revealedToken)
    : undefined;
  const errorMessage = clientErrorMessage(copyError ?? tokenError, {
    loading: t.errorLoading,
    mutation: t.errorToken,
    copy: t.errorCopy,
  });

  async function onUploadTokenRotate() {
    if (!tokenStatus || isSubmitting) return;
    setCopyError(undefined);
    await rotateUploadToken();
  }

  async function onUploadTokenRevoke() {
    if (!tokenStatus?.configured || isSubmitting) return;
    setCopyError(undefined);
    await revokeUploadToken();
  }

  async function onSkillConfigCopy() {
    if (!revealedConfig) return;
    try {
      await navigator.clipboard.writeText(revealedConfig);
    } catch (error) {
      setCopyError(clientError(error, "copy"));
    }
  }

  useEffect(() => {
    void loadUploadTokenStatus();
    return hideUploadToken;
  }, []);

  return (
    <>
      {errorMessage && (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <Card
        className="mt-8 rounded-xl border-border bg-card shadow-none"
        size="sm"
      >
        <CardHeader className="grid-cols-[1fr_auto]">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <KeyRound className="size-4 text-primary" />
              {t.tokenTitle}
            </CardTitle>
            <p className="mt-1 mb-0 text-muted-foreground text-xs leading-relaxed">
              {t.tokenDescription}
            </p>
          </div>
          {tokenStatus ? (
            <Badge
              className={
                tokenStatus.configured
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground"
              }
              variant="outline"
            >
              <ShieldCheck />
              {tokenStatus.configured
                ? t.configuredLabel
                : t.notConfiguredLabel}
            </Badge>
          ) : (
            <Skeleton aria-label={t.loading} className="h-5 w-24" />
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {revealedConfig && (
            <div className="space-y-2 rounded border border-warning/25 bg-warning/10 p-3">
              <p className="m-0 text-warning text-xs leading-relaxed">
                {t.tokenOnceHint}
              </p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-2xs text-muted-foreground">
                  {ARTIFACT_SKILL_CONFIG_PATH}
                </code>
                <Button
                  aria-label={t.copyConfigAction}
                  onClick={onSkillConfigCopy}
                  size="icon"
                  title={t.copyConfigAction}
                  type="button"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
              <section
                aria-label={t.configJsonLabel}
                className="m-0 overflow-x-auto rounded border border-border bg-code p-3 text-2xs text-foreground"
              >
                <pre className="m-0">
                  <code>{revealedConfig}</code>
                </pre>
              </section>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {tokenStatus?.configured ? (
              <>
                <ConfirmDialog
                  cancelLabel={t.cancelAction}
                  confirmLabel={t.rotateTokenAction}
                  description={t.rotateConfirmation}
                  isDestructive={false}
                  isDisabled={isSubmitting}
                  onConfirm={onUploadTokenRotate}
                  title={t.rotateTokenAction}
                  trigger={
                    <Button
                      disabled={isSubmitting}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw />
                      {t.rotateTokenAction}
                    </Button>
                  }
                />
                <ConfirmDialog
                  cancelLabel={t.cancelAction}
                  confirmLabel={t.revokeTokenAction}
                  description={t.revokeConfirmation}
                  isDisabled={isSubmitting}
                  onConfirm={onUploadTokenRevoke}
                  title={t.revokeTokenAction}
                  trigger={
                    <Button
                      disabled={isSubmitting}
                      size="sm"
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                      {t.revokeTokenAction}
                    </Button>
                  }
                />
              </>
            ) : (
              <Button
                disabled={!tokenStatus || isSubmitting}
                onClick={onUploadTokenRotate}
                size="sm"
                type="button"
              >
                <RefreshCw />
                {t.createTokenAction}
              </Button>
            )}
            {tokenStatus?.lastUsedAt && (
              <span className="ml-auto text-muted-foreground text-xs">
                {t.lastUsedLabel}:{" "}
                {new Date(tokenStatus.lastUsedAt).toLocaleString(prefs.locale)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
