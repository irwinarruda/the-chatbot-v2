import { Link } from "@tanstack/react-router";
import {
  Check,
  ListTodo,
  type LucideIcon,
  NotebookPen,
  PanelsTopLeft,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { AuthCard } from "~/client/modules/identity/components/AuthCard";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { useApp } from "~/client/shared/stores/app";
import type { OAuthConsentDecision } from "~/contracts/http/mcp/oauth";

type AccessKey =
  | "accessCashFlow"
  | "accessBills"
  | "accessNotes"
  | "accessTodos"
  | "accessArtifacts";

const AccessItems: { key: AccessKey; icon: LucideIcon }[] = [
  { key: "accessCashFlow", icon: Wallet },
  { key: "accessBills", icon: ReceiptText },
  { key: "accessNotes", icon: NotebookPen },
  { key: "accessTodos", icon: ListTodo },
  { key: "accessArtifacts", icon: PanelsTopLeft },
];

function isWebUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "https:" || protocol === "http:";
}

export function OAuthConsentScreen({
  authorizationQuery,
}: {
  authorizationQuery: string;
}) {
  const dictionary = useDictionary();
  const t = dictionary.oauthConsentPage;
  const prompt = useApp((state) => state.consentPrompt);
  const redirectUrl = useApp((state) => state.consentRedirectUrl);
  const isLoading = useApp((state) => state.isConsentLoading);
  const isDeciding = useApp((state) => state.isConsentDeciding);
  const error = useApp((state) => state.consentError);
  const loadConsent = useApp((state) => state.loadConsent);
  const decideConsent = useApp((state) => state.decideConsent);
  const resetConsent = useApp((state) => state.resetConsent);
  const errorMessage = clientErrorMessage(error, {
    loading: t.errorLoading,
    deciding: t.errorDeciding,
  });

  useEffect(() => {
    void loadConsent(authorizationQuery);
    return resetConsent;
  }, [authorizationQuery]);

  useEffect(() => {
    if (redirectUrl && isWebUrl(redirectUrl)) {
      window.location.assign(redirectUrl);
    }
  }, [redirectUrl]);

  function onDecide(decision: OAuthConsentDecision) {
    return () => void decideConsent(authorizationQuery, decision);
  }

  return (
    <AppShell
      dictionary={dictionary}
      showNavigation={false}
      title={t.windowTitle}
    >
      {isLoading && (
        <AuthCard heading={t.heading} icon={ShieldCheck}>
          <div role="status" className="space-y-2">
            <span className="sr-only">{t.loadingLabel}</span>
            <Skeleton className="mx-auto h-4 w-5/6" />
            <Skeleton className="mx-auto h-4 w-2/3" />
            <Skeleton className="mx-auto mt-4 h-24 w-full" />
          </div>
        </AuthCard>
      )}
      {!isLoading && !prompt && (
        <AuthCard
          actions={
            <Button
              className="h-11 w-full"
              nativeButton={false}
              render={<Link to="/" />}
              variant="ghost"
            >
              {t.homeAction}
            </Button>
          }
          heading={t.errorHeading}
          icon={ShieldAlert}
          iconClassName="bg-warning-soft text-warning"
        >
          {errorMessage ?? t.errorLoading}
        </AuthCard>
      )}
      {!isLoading && prompt && (
        <AuthCard
          actions={
            <>
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              <Button
                className="h-11 w-full"
                disabled={isDeciding}
                onClick={onDecide("approve")}
                type="button"
              >
                {redirectUrl ? t.redirectingAction : t.allowAction}
              </Button>
              <Button
                className="h-11 w-full"
                disabled={isDeciding}
                onClick={onDecide("deny")}
                type="button"
                variant="ghost"
              >
                {t.denyAction}
              </Button>
            </>
          }
          footnote={t.redirectNote.replace("{host}", prompt.redirectHost)}
          heading={t.heading}
          icon={ShieldCheck}
        >
          <p className="m-0 break-words">
            <strong className="font-semibold text-foreground">
              {prompt.clientName}
            </strong>
            {t.introMiddle}
            <strong className="font-semibold text-foreground">
              {prompt.userEmail}
            </strong>
            {t.introEnd}
          </p>
          <ul className="m-0 mt-4 grid list-none gap-2 rounded-xl border border-border bg-background p-3 text-left">
            {AccessItems.map(({ key, icon: Icon }) => (
              <li
                className="flex items-center gap-3 text-foreground text-sm"
                key={key}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">{t[key]}</span>
                <Check
                  className="size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </AuthCard>
      )}
    </AppShell>
  );
}
