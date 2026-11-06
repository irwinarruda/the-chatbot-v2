import { createFileRoute } from "@tanstack/react-router";
import { UpdateMonthlyExpenseRequestDTO } from "~/contracts/http/cash-flow/monthly-expense";
import { toMonthlyExpenseResponse } from "~/contracts/http/cash-flow/monthly-expense-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/monthly-expenses/$expenseId")(
  {
    server: {
      handlers: {
        async PATCH({ request, context, params }) {
          const service = getServer().services.monthlyExpenses;
          const body = UpdateMonthlyExpenseRequestDTO.parse(
            await parseJsonRequest(request),
          );
          const expense = await service.updateMonthlyExpense({
            idUser: context.webAuth.userId,
            id: params.expenseId,
            name: body.name,
            expectedAmount: body.expectedAmount ?? undefined,
            clearExpectedAmount: body.expectedAmount === null,
            dueDay: body.dueDay ?? undefined,
            clearDueDay: body.dueDay === null,
            category: body.category ?? undefined,
            clearCategory: body.category === null,
            defaultBankAccount: body.defaultBankAccount ?? undefined,
            clearDefaultBankAccount: body.defaultBankAccount === null,
            month: body.month,
          });
          return Http.json({ expense: toMonthlyExpenseResponse(expense) });
        },
        async DELETE({ context, params }) {
          const service = getServer().services.monthlyExpenses;
          await service.archiveMonthlyExpense(
            context.webAuth.userId,
            params.expenseId,
          );
          return Http.ok();
        },
      },
    },
  },
);
