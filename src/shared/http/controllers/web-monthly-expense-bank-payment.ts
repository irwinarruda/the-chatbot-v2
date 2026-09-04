import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toMonthlyExpenseResponse } from "~/modules/cash-flow/contracts/MonthlyExpenseContractMapper";
import { PayMonthlyExpenseRequestDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

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
          await ServerBootstrap.getApplication().services.monthlyExpensePayments.payFromAccount(
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
