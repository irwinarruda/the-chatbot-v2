import { createFileRoute } from "@tanstack/react-router";
import { PayMonthlyExpenseRequestDTO } from "~/contracts/http/cash-flow/monthly-expense";
import { toMonthlyExpenseResponse } from "~/contracts/http/cash-flow/monthly-expense-mapper";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute(
  "/api/v1/web/monthly-expenses/$expenseId/bank-payment",
)({
  server: {
    handlers: {
      async POST({ request, context, params }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber)
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        const body = PayMonthlyExpenseRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const expense =
          await getServer().services.monthlyExpensePayments.payFromAccount(
            context.webAuth.userId,
            phoneNumber,
            params.expenseId,
            body,
          );
        return Http.json({ expense: toMonthlyExpenseResponse(expense) });
      },
    },
  },
});
