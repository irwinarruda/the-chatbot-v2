import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toMonthlyExpenseResponse } from "~/modules/cash-flow/contracts/MonthlyExpenseContractMapper";
import {
  CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseMonthDTO,
  MonthlyExpensesResponseDTO,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/monthly-expenses")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const service =
          ServerBootstrap.getApplication().services.monthlyExpenses;
        const rawMonth = new URL(request.url).searchParams.get("month");
        const month = rawMonth
          ? MonthlyExpenseMonthDTO.parse(rawMonth)
          : undefined;
        const expenses = await service.listMonthlyExpenses(
          context.webAuth.userId,
          month,
        );
        return Http.json(
          MonthlyExpensesResponseDTO.parse({
            month: month ?? service.currentMonth(),
            expenses: expenses.map(toMonthlyExpenseResponse),
          }),
        );
      },
      async POST({ request, context }) {
        const service =
          ServerBootstrap.getApplication().services.monthlyExpenses;
        const body = CreateMonthlyExpenseRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const expense = await service.createMonthlyExpense({
          idUser: context.webAuth.userId,
          name: body.name,
          expectedAmount: body.expectedAmount,
          dueDay: body.dueDay,
          month: body.month,
        });
        return Http.json({ expense: toMonthlyExpenseResponse(expense) });
      },
    },
  },
});
