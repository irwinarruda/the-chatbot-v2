import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toCashFlowDashboardResponse } from "~/modules/cash-flow/contracts/CashFlowContractMapper";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/cash-flow")({
  server: {
    handlers: {
      async GET({ context }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber) {
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        }
        const service = ServerBootstrap.getApplication().services.cashFlow;
        const dashboard = await service.getDashboard(phoneNumber);
        return Http.json(toCashFlowDashboardResponse(dashboard));
      },
    },
  },
});
