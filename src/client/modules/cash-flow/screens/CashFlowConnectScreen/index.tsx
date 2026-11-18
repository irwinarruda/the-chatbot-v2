import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, FileSpreadsheet } from "lucide-react";
import { useEffect } from "react";
import type { CashFlowErrorCode } from "~/client/modules/cash-flow/app/services/CashFlowService";
import type { CashFlowConnectSearch } from "~/client/modules/cash-flow/parsers/CashFlowConnectSearch";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

export function CashFlowConnectScreen({
  search,
}: {
  search: CashFlowConnectSearch;
}) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const resetFeature = useApp((state) => state.resetCashFlow);
  const isSubmitting = useApp((state) => state.isCashFlowSubmitting);
  const error = useApp((state) => state.cashFlowError);
  const connectSpreadsheet = useApp(
    (state) => state.connectCashFlowSpreadsheet,
  );
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.cashFlowPage;
  const errorMessages: Record<CashFlowErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    syncing: t.errorSyncing,
    deleting: t.errorDeleting,
    connecting: t.errorConnecting,
  };
  const errorMessage = clientErrorMessage(error, errorMessages);

  async function onSpreadsheetConnect() {
    const isConnected = await connectSpreadsheet(search.spreadsheet);
    if (isConnected) await navigate({ to: "/cash-flow" });
  }

  useEffect(() => resetFeature, [resetFeature]);

  return (
    <AppShell
      activePath="/cash-flow"
      dictionary={dictionary}
      showLogout
      title={t.connectWindowTitle}
    >
      <TerminalPageHeader
        primaryAction={{
          icon: FileSpreadsheet,
          isDisabled: isSubmitting,
          label: t.connectChooseAction,
          onClick: () => void onSpreadsheetConnect(),
          shouldKeepLabel: true,
        }}
        heading={t.connectHeading}
        subtitle={t.connectSubtitle}
      />
      {errorMessage && (
        <Alert className="mb-4" variant="destructive">
          <CircleAlert />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-muted-foreground text-sm">
        {t.connectHint}
      </p>
    </AppShell>
  );
}
