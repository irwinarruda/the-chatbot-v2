import { createFileRoute } from "@tanstack/react-router";
import { SaveCashFlowTransferRequestDTO } from "~/contracts/http/cash-flow/cash-flow-transfer";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

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
        await getServer().services.cashFlow.transferBetweenBankAccounts({
          ...body,
          phoneNumber,
          date: new Date(`${body.date}T12:00:00.000Z`),
        });
        return Http.ok({ status: 201 });
      },
    },
  },
});
