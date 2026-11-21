import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DeleteCashFlowTransactionRequestDTO } from "~/contracts/http/cash-flow/cash-flow";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute(
  "/api/v1/web/cash-flow/transactions/$position",
)({
  server: {
    handlers: {
      async DELETE({ request, context, params }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber)
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        const position = z.coerce
          .number()
          .int()
          .nonnegative()
          .parse(params.position);
        const body = DeleteCashFlowTransactionRequestDTO.parse(
          await parseJsonRequest(request),
        );
        await getServer().services.cashFlow.deleteTransaction({
          ...body,
          phoneNumber,
          position,
          date: new Date(`${body.date}T12:00:00.000Z`),
        });
        return Http.ok();
      },
    },
  },
});
