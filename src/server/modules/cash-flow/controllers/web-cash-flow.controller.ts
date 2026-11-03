import { createFileRoute } from "@tanstack/react-router";
import { toCashFlowDashboardResponse } from "~/contracts/http/cash-flow/cash-flow-mapper";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

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
        const service = getServer().services.cashFlow;
        const dashboard = await service.getDashboard(phoneNumber);
        return Http.json(toCashFlowDashboardResponse(dashboard));
      },
    },
  },
});
