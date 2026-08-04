import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { CreateCashFlowTransactionRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

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
        const service = ServerBootstrap.getApplication().services.cashFlow;
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
