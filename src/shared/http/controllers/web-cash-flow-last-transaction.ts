import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";

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
          const service = ServerBootstrap.getApplication().services.cashFlow;
          await service.deleteLastTransaction(phoneNumber);
          return Http.ok();
        },
      },
    },
  },
);
