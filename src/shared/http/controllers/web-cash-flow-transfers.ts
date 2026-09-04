import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { SaveCashFlowTransferRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/cash-flow/transfers")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber)
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        const body = SaveCashFlowTransferRequestDTO.parse(
          await parseJsonRequest(request),
        );
        await ServerBootstrap.getApplication().services.cashFlow.transferBetweenBankAccounts(
          {
            ...body,
            phoneNumber,
            date: new Date(`${body.date}T12:00:00.000Z`),
          },
        );
        return Http.ok({ status: 201 });
      },
    },
  },
});
