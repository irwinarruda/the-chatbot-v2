import { createFileRoute } from "@tanstack/react-router";
import {
  CashFlowSpreadsheetPickerResponseDTO,
  ConnectCashFlowSpreadsheetRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow-spreadsheet";
import { ValidationException } from "~/domain/shared/domain-errors";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/cash-flow/spreadsheet")({
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
        const picker = await service.getSpreadsheetPicker(phoneNumber);
        return Http.json(CashFlowSpreadsheetPickerResponseDTO.parse(picker));
      },
      async PUT({ request, context }) {
        const phoneNumber = context.webAuth.phoneNumber;
        if (!phoneNumber) {
          throw new ValidationException(
            "A phone number is required to access cash flow",
          );
        }
        const body = ConnectCashFlowSpreadsheetRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const service = getServer().services.cashFlow;
        await service.addSpreadsheetUrl(phoneNumber, body.url);
        return Http.ok({ status: 204 });
      },
    },
  },
});
