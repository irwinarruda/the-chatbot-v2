import { createFileRoute } from "@tanstack/react-router";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/web/cash-flow/transactions/last")(
  {
    server: {
      handlers: {
        async DELETE({ context }) {
          const phoneNumber = context.webAuth.phoneNumber;
          if (!phoneNumber) {
            throw new ValidationException(
              "A phone number is required to access cash flow",
            );
          }
          const service = getServer().services.cashFlow;
          await service.deleteLastTransaction(phoneNumber);
          return Http.ok();
        },
      },
    },
  },
);
