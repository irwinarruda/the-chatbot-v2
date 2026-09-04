import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { SaveCashFlowTransferRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute(
  "/api/v1/web/cash-flow/transfers/$transferId",
)({
  server: {
    handlers: {
      async PATCH({ request, context, params }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber)
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        const body = SaveCashFlowTransferRequestDTO.parse(
          await parseJsonRequest(request),
        );
        if (body.id !== params.transferId)
          throw new ValidationException("Transfer ID does not match");
        await ServerBootstrap.getApplication().services.cashFlow.transferBetweenBankAccounts(
          {
            ...body,
            phoneNumber,
            date: new Date(`${body.date}T12:00:00.000Z`),
          },
          true,
        );
        return Http.ok();
      },
      async DELETE({ context, params }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber)
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        const id = z.uuid().parse(params.transferId);
        await ServerBootstrap.getApplication().services.cashFlow.deleteTransfer(
          phoneNumber,
          id,
        );
        return Http.ok();
      },
    },
  },
});
