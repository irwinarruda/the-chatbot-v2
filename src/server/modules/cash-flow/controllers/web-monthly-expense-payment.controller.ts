import { createFileRoute } from "@tanstack/react-router";
import { SetMonthlyExpensePaidRequestDTO } from "~/contracts/http/cash-flow/monthly-expense";
import { toMonthlyExpenseResponse } from "~/contracts/http/cash-flow/monthly-expense-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute(
  "/api/v1/web/monthly-expenses/$expenseId/payment",
)({
  server: {
    handlers: {
      async PATCH({ request, context, params }) {
        const service = getServer().services.monthlyExpenses;
        const body = SetMonthlyExpensePaidRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const expense = await service.setMonthlyExpensePaid(
          context.webAuth.userId,
          params.expenseId,
          body.isPaid,
          body.month,
        );
        return Http.json({ expense: toMonthlyExpenseResponse(expense) });
      },
    },
  },
});
