import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toMonthlyExpenseResponse } from "~/modules/cash-flow/contracts/MonthlyExpenseContractMapper";
import { UpdateMonthlyExpenseRequest } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/monthly-expenses/$expenseId")(
  {
    server: {
      handlers: {
        async PATCH({ request, context, params }) {
          const service =
            ServerBootstrap.getApplication().services.monthlyExpenses;
          const body = UpdateMonthlyExpenseRequest.parse(await request.json());
          const expense = await service.updateMonthlyExpense({
            idUser: context.webAuth.userId,
            id: params.expenseId,
            name: body.name,
            expectedAmount: body.expectedAmount ?? undefined,
            clearExpectedAmount: body.expectedAmount === null,
            dueDay: body.dueDay ?? undefined,
            clearDueDay: body.dueDay === null,
          });
          return Http.json({ expense: toMonthlyExpenseResponse(expense) });
        },
        async DELETE({ context, params }) {
          const service =
            ServerBootstrap.getApplication().services.monthlyExpenses;
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
