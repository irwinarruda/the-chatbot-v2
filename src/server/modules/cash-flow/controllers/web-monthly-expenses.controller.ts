import { createFileRoute } from "@tanstack/react-router";
import {
  CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseMonthDTO,
  MonthlyExpensesResponseDTO,
} from "~/contracts/http/cash-flow/monthly-expense";
import { toMonthlyExpenseResponse } from "~/contracts/http/cash-flow/monthly-expense-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/monthly-expenses")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const service = getServer().services.monthlyExpenses;
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
        const service = getServer().services.monthlyExpenses;
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
