import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { artifactService } from "~/modules/artifacts/client/services/artifactService";
import type { ArtifactUploadTokenStatusResponseDTO } from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/shared/client/components/ui/card";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";

const ARTIFACT_SKILL_CONFIG_PATH =
  "~/.agents/skills/the-chatbot-artifact/config.json";

type TokenError = "loading" | "mutation" | "copy";

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
  const [tokenStatus, setTokenStatus] =
    useState<ArtifactUploadTokenStatusResponseDTO>();
  const [revealedConfig, setRevealedConfig] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TokenError>();
  const t = getDictionary(prefs.locale).artifactsPage;
  let errorMessage: string | undefined;
  if (error === "loading") errorMessage = t.errorLoading;
  if (error === "mutation") errorMessage = t.errorToken;
  if (error === "copy") errorMessage = t.errorCopy;

  async function onUploadTokenRotate() {
    if (!tokenStatus || isSubmitting) return;
    if (tokenStatus.configured && !window.confirm(t.rotateConfirmation)) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const created = await artifactService.rotateUploadToken();
      setTokenStatus(created);
      setRevealedConfig(createArtifactSkillConfig(created.token));
    } catch {
      setError("mutation");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onUploadTokenRevoke() {
    if (!tokenStatus?.configured || isSubmitting) return;
    if (!window.confirm(t.revokeConfirmation)) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await artifactService.revokeUploadToken();
      setTokenStatus({ configured: false });
      setRevealedConfig(undefined);
    } catch {
      setError("mutation");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSkillConfigCopy() {
    if (!revealedConfig) return;
    try {
      await navigator.clipboard.writeText(revealedConfig);
    } catch {
      setError("copy");
    }
  }

  useEffect(() => {
    let isCurrent = true;
    void artifactService
      .getUploadTokenStatus()
      .then((status) => {
        if (isCurrent) setTokenStatus(status);
      })
      .catch(() => {
        if (isCurrent) setError("loading");
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
      <Card className="mb-6 border-term-border bg-term-bg/60" size="sm">
        <CardHeader className="grid-cols-[1fr_auto]">
          <div>
            <CardTitle className="flex items-center gap-2 text-term-bright">
              <KeyRound className="size-4 text-term-amber" />
              {t.tokenTitle}
            </CardTitle>
            <p className="mt-1 mb-0 text-term-muted text-xs leading-relaxed">
              {t.tokenDescription}
            </p>
          </div>
          {tokenStatus ? (
            <Badge
              className={
                tokenStatus.configured
                  ? "border-term-green/25 bg-term-green/10 text-term-green"
                  : "border-term-muted/25 bg-term-muted/10 text-term-muted"
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
            <div className="space-y-2 rounded border border-term-amber/25 bg-term-amber/8 p-3">
              <p className="m-0 text-term-amber text-xs leading-relaxed">
                {t.tokenOnceHint}
              </p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-2xs text-term-muted">
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
                className="m-0 overflow-x-auto rounded border border-term-border bg-term-bg/60 p-3 text-2xs text-term-muted"
              >
                <pre className="m-0">
                  <code>{revealedConfig}</code>
                </pre>
              </section>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!tokenStatus || isSubmitting}
              onClick={onUploadTokenRotate}
              size="sm"
              type="button"
            >
              <RefreshCw />
              {tokenStatus?.configured
                ? t.rotateTokenAction
                : t.createTokenAction}
            </Button>
            {tokenStatus?.configured && (
              <Button
                disabled={isSubmitting}
                onClick={onUploadTokenRevoke}
                size="sm"
                type="button"
                variant="destructive"
              >
                <Trash2 />
                {t.revokeTokenAction}
              </Button>
            )}
            {tokenStatus?.lastUsedAt && (
              <span className="ml-auto text-2xs text-term-muted">
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
