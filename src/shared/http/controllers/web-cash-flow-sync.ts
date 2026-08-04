import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { SyncCashFlowBankAccountRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/cash-flow/sync")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber) {
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        }
        const body = SyncCashFlowBankAccountRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const service = ServerBootstrap.getApplication().services.cashFlow;
        await service.syncBankAccountBalance({
          phoneNumber,
          bankAccount: body.bankAccount,
          currentBalance: body.currentBalance,
          category: body.category,
          description: body.description,
          date: new Date(`${body.date}T12:00:00.000Z`),
        });
        return Http.ok({ status: 201 });
      },
    },
  },
});
