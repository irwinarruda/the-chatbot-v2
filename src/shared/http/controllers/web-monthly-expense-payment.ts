import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toMonthlyExpenseResponse } from "~/modules/cash-flow/contracts/MonthlyExpenseContractMapper";
import { SetMonthlyExpensePaidRequestDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute(
  "/api/v1/web/monthly-expenses/$expenseId/payment",
)({
  server: {
    handlers: {
      async PATCH({ request, context, params }) {
        const service =
          ServerBootstrap.getApplication().services.monthlyExpenses;
        const body = SetMonthlyExpensePaidRequestDTO.parse(
          await request.json(),
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
