import { createFileRoute } from "@tanstack/react-router";
import { CreateCashFlowTransactionRequestDTO } from "~/contracts/http/cash-flow/cash-flow";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/cash-flow/transactions")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber) {
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        }
        const body = CreateCashFlowTransactionRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const service = getServer().services.cashFlow;
        await service.addTransaction({
          phoneNumber,
          type: body.type,
          date: new Date(`${body.date}T12:00:00.000Z`),
          value: body.value,
          category: body.category,
          description: body.description,
          bankAccount: body.bankAccount,
        });
        return Http.ok({ status: 201 });
      },
    },
  },
});
