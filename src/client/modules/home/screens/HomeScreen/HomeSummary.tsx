import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { calculateCashFlowNetBalance } from "~/client/modules/cash-flow/parsers/CashFlowBalances";
import {
  getTodoDueUrgency,
  TodoDueUrgency,
} from "~/client/modules/todos/parsers/TodoDueDate";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { cn } from "~/client/shared/components/ui/lib/utils";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { useApp } from "~/client/shared/stores/app";

type SummaryPath = "/todo" | "/bills" | "/cash-flow" | "/notes";

function SummaryTile({
  children,
  detail,
  href,
  isUnavailable = false,
  label,
  unavailableLabel,
}: {
  children: ReactNode;
  detail: ReactNode;
  href: SummaryPath;
  isUnavailable?: boolean;
  label: string;
  unavailableLabel: string;
}) {
  return (
    <li>
      <Link
        to={href}
        className="group flex h-full flex-col rounded-xl border border-border bg-card px-4 py-3 outline-none transition-colors hover:border-brand/40 focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <span className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
          {label}
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text motion-reduce:transition-none"
          />
        </span>
        <span className="mt-1 font-semibold text-foreground text-xl tabular-nums tracking-tight">
          {isUnavailable ? "—" : children}
        </span>
        <span className="mt-0.5 text-muted-foreground text-xs">
          {isUnavailable ? unavailableLabel : detail}
        </span>
      </Link>
    </li>
  );
}

export function HomeSummary({ isSignedIn }: { isSignedIn: boolean }) {
  const dictionary = useDictionary();
  const prefs = usePrefs();
  const t = dictionary.welcomePage.summary;
  const bootstrapTodos = useApp((state) => state.bootstrapTodos);
  const bootstrapCashFlow = useApp((state) => state.bootstrapCashFlow);
  const bootstrapMonthlyExpenses = useApp(
    (state) => state.bootstrapMonthlyExpenses,
  );
  const bootstrapNotes = useApp((state) => state.bootstrapNotes);
  const todos = useApp((state) => state.todos);
  const notes = useApp((state) => state.notes);
  const dashboard = useApp((state) => state.cashFlowDashboard);
  const expenses = useApp((state) => state.monthlyExpenses);
  const todoError = useApp((state) => state.todoError);
  const cashFlowError = useApp((state) => state.cashFlowError);
  const monthlyExpenseError = useApp((state) => state.monthlyExpenseError);
  const noteError = useApp((state) => state.noteError);
  const isBootstrapping = useApp(
    (state) =>
      state.isTodoBootstrapping ||
      state.isCashFlowBootstrapping ||
      state.isMonthlyExpenseBootstrapping ||
      state.isNoteBootstrapping,
  );
  const [hasRequested, setHasRequested] = useState(false);
  const isLoading = !hasRequested || isBootstrapping;
  const currency = new Intl.NumberFormat(
    prefs.locale === "pt-BR" ? "pt-BR" : "en-US",
    { style: "currency", currency: "BRL" },
  );
  const now = new Date();
  const pendingTodos = todos.filter((todo) => todo.status === "Pending");
  const overdueCount = pendingTodos.filter(
    (todo) =>
      todo.dueDate &&
      getTodoDueUrgency(todo.dueDate, now) === TodoDueUrgency.Overdue,
  ).length;
  const unpaidExpenses = expenses.filter((expense) => !expense.isPaid);
  const leftToPay = unpaidExpenses.reduce(
    (total, expense) => total + (expense.expectedAmount ?? 0),
    0,
  );
  const netBalance = calculateCashFlowNetBalance(dashboard.bankAccountStatuses);
  const latestNote = [...notes].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  )[0];

  useEffect(() => {
    if (!isSignedIn) return;
    void bootstrapTodos();
    void bootstrapCashFlow();
    void bootstrapMonthlyExpenses();
    void bootstrapNotes();
    setHasRequested(true);
  }, [isSignedIn]);

  if (!isSignedIn) return undefined;

  return (
    <section aria-labelledby="home-summary" className="mb-8">
      <h2
        className="mb-3 font-medium text-foreground text-sm"
        id="home-summary"
      >
        {t.title}
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["todos", "bills", "cash", "notes"].map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
          <SummaryTile
            detail={
              <span className={cn(overdueCount > 0 && "text-destructive")}>
                {t.overdue.replace("{count}", overdueCount.toString())}
              </span>
            }
            href="/todo"
            isUnavailable={todoError !== undefined}
            label={t.todos}
            unavailableLabel={t.unavailable}
          >
            {pendingTodos.length}
          </SummaryTile>
          <SummaryTile
            detail={t.unpaidBills.replace(
              "{count}",
              unpaidExpenses.length.toString(),
            )}
            href="/bills"
            isUnavailable={monthlyExpenseError !== undefined}
            label={t.bills}
            unavailableLabel={t.unavailable}
          >
            <MonetaryValue hiddenLabel={dictionary.common.hiddenMonetaryValue}>
              {currency.format(leftToPay)}
            </MonetaryValue>
          </SummaryTile>
          <SummaryTile
            detail={t.accounts.replace(
              "{count}",
              dashboard.bankAccountStatuses.length.toString(),
            )}
            href="/cash-flow"
            isUnavailable={cashFlowError !== undefined}
            label={t.cashFlow}
            unavailableLabel={t.unavailable}
          >
            <MonetaryValue hiddenLabel={dictionary.common.hiddenMonetaryValue}>
              {currency.format(netBalance)}
            </MonetaryValue>
          </SummaryTile>
          <SummaryTile
            detail={
              <span className="block truncate">
                {latestNote ? latestNote.name : t.noNotes}
              </span>
            }
            href="/notes"
            isUnavailable={noteError !== undefined}
            label={t.notes}
            unavailableLabel={t.unavailable}
          >
            {notes.length}
          </SummaryTile>
        </ul>
      )}
    </section>
  );
}
