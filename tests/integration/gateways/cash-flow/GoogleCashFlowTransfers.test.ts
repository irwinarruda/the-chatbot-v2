import { google, type sheets_v4 } from "googleapis";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { SaveSpreadsheetTransferDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import { GoogleCashFlowSpreadsheetGateway } from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway/GoogleCashFlowSpreadsheetGateway";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { orquestrator } from "~/tests/orquestrator";

const transfer: SaveSpreadsheetTransferDTO = {
  sheetId: "local-protocol-fixture",
  sheetAccessToken: "test-only",
  id: "a5337eac-71f5-4cce-9a4e-f2e4a95d789f",
  from: "NuConta",
  to: "Caju",
  value: 100.25,
  date: new Date("2026-09-04T12:00:00Z"),
  category: "Transferência",
  description: "",
};

function row(account: string, value: string, note: string) {
  return {
    values: [
      { formattedValue: "04/09/2026", note },
      { formattedValue: "Friday" },
      { formattedValue: value },
      { formattedValue: "Transferência" },
      { formattedValue: "" },
      { formattedValue: account },
    ],
  };
}

function setup(rows: sheets_v4.Schema$RowData[] = [], rowCount = 1000) {
  const get = vi.fn(async () => ({
    data: {
      sheets: [
        {
          properties: { sheetId: 42, gridProperties: { rowCount } },
          data: [{ rowData: [{}, {}, ...rows] }],
        },
      ],
    },
  }));
  const batchUpdate = vi.fn(
    async (request: sheets_v4.Params$Resource$Spreadsheets$Batchupdate) => {
      let nextRowCount = rowCount;
      for (const item of request.requestBody?.requests ?? []) {
        if (item.appendDimension?.dimension === "ROWS") {
          nextRowCount += item.appendDimension.length ?? 0;
        }
        const startRow = item.updateCells?.start?.rowIndex;
        if (
          startRow !== undefined &&
          startRow !== null &&
          startRow + (item.updateCells?.rows?.length ?? 0) > nextRowCount
        ) {
          throw new Error("Write exceeds the journal grid");
        }
      }
      rowCount = nextRowCount;
      return { data: {} };
    },
  );
  vi.spyOn(google, "sheets").mockReturnValue({
    spreadsheets: { get, batchUpdate },
  } as unknown as sheets_v4.Sheets);
  const gateway = new GoogleCashFlowSpreadsheetGateway(
    orquestrator.googleConfig,
    orquestrator.googleSheetsConfig,
  );
  return { gateway, get, batchUpdate };
}

afterEach(() => vi.restoreAllMocks());

describe("Google Sheets linked writes", () => {
  test.each([0, 1, 2])(
    "creates both transfer entries with %i journal rows remaining",
    async (remainingRows) => {
      const { gateway, get, batchUpdate } = setup(
        [row("NuConta", "-20", "")],
        3 + remainingRows,
      );
      await gateway.saveTransfer(transfer, false);
      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.stringContaining("gridProperties(rowCount)"),
        }),
      );
      expect(batchUpdate).toHaveBeenCalledOnce();
      const requests = batchUpdate.mock.calls[0][0].requestBody?.requests ?? [];
      const expansion = requests.filter((item) => item.appendDimension);
      if (remainingRows < 2) {
        expect(expansion).toEqual([
          {
            appendDimension: {
              sheetId: 42,
              dimension: "ROWS",
              length: 2 - remainingRows,
            },
          },
        ]);
        expect(requests[0]).toEqual(expansion[0]);
      } else {
        expect(expansion).toEqual([]);
      }
      expect(
        requests
          .filter((item) => item.updateCells)
          .map((item) => item.updateCells?.start?.rowIndex),
      ).toEqual([3, 3, 4, 4]);
    },
  );

  test("records a bill payment when the journal is full", async () => {
    const { gateway, batchUpdate } = setup([row("NuConta", "-20", "")], 3);
    const payment = await gateway.addBillPayment({
      ...transfer,
      bankAccount: "NuConta",
      paymentId: "bill-id:2026-09",
    });
    expect(payment.value).toBe(-100.25);
    expect(batchUpdate).toHaveBeenCalledOnce();
    const requests = batchUpdate.mock.calls[0][0].requestBody?.requests ?? [];
    expect(requests).toHaveLength(3);
    expect(requests[0]).toEqual({
      appendDimension: { sheetId: 42, dimension: "ROWS", length: 1 },
    });
    expect(requests[1].updateCells?.start?.rowIndex).toBe(3);
    expect(requests[2].updateCells?.start?.rowIndex).toBe(3);
  });

  test("creates debit, credit, and link notes together in one batch while preserving formula columns", async () => {
    const { gateway, batchUpdate } = setup();
    await gateway.saveTransfer(transfer, false);
    expect(batchUpdate).toHaveBeenCalledOnce();
    const requests = batchUpdate.mock.calls[0][0].requestBody?.requests ?? [];
    expect(requests).toHaveLength(4);
    expect(
      requests.map((item) => item.updateCells?.start?.columnIndex),
    ).toEqual([1, 3, 1, 3]);
    expect(requests[0].updateCells?.rows?.[0].values?.[0].note).toBe(
      `the-chatbot:transfer:${transfer.id}`,
    );
    expect(requests[2].updateCells?.rows?.[0].values?.[0].note).toBe(
      `the-chatbot:transfer:${transfer.id}`,
    );
    expect(
      requests[1].updateCells?.rows?.[0].values?.[0].userEnteredValue
        ?.numberValue,
    ).toBe(-100.25);
    expect(
      requests[3].updateCells?.rows?.[0].values?.[0].userEnteredValue
        ?.numberValue,
    ).toBe(100.25);
    const serialDate =
      requests[0].updateCells?.rows?.[0].values?.[0].userEnteredValue
        ?.numberValue;
    expect(new Date(((serialDate ?? 0) - 25569) * 86400000).toISOString()).toBe(
      "2026-09-04T00:00:00.000Z",
    );
  });

  test("finds a linked pair after row reordering, deduplicates retries, and clears only both entries", async () => {
    const note = `the-chatbot:transfer:${transfer.id}`;
    const { gateway, batchUpdate } = setup(
      [
        row("Caju", "100,25", note),
        row("NuConta", "20", "User note"),
        {},
        row("NuConta", "-100,25", note),
      ],
      6,
    );
    const transactions = await gateway.getAllTransactions(transfer);
    expect(transactions.map((item) => item.transferId)).toEqual([
      transfer.id,
      undefined,
      transfer.id,
    ]);
    await gateway.saveTransfer(transfer, false);
    expect(batchUpdate).not.toHaveBeenCalled();
    await gateway.saveTransfer({ ...transfer, value: 80 }, true);
    expect(
      batchUpdate.mock.calls[0][0].requestBody?.requests?.map(
        (request) => request.updateCells?.start?.rowIndex,
      ),
    ).toEqual([2, 2, 5, 5]);
    await gateway.deleteTransfer(transfer, transfer.id);
    expect(
      batchUpdate.mock.calls[1][0].requestBody?.requests?.map(
        (request) => request.updateCells?.range?.startRowIndex,
      ),
    ).toEqual([2, 2, 5, 5]);
  });

  test("reconciles a bill payment from its durable note using the original values", async () => {
    const paymentId = "bill-id:2026-09";
    const { gateway, batchUpdate } = setup([
      row("NuConta", "-120,25", `the-chatbot:bill:${paymentId}`),
    ]);
    const payment = await gateway.addBillPayment({
      ...transfer,
      bankAccount: "Caju",
      paymentId,
      value: 900,
    });
    expect(payment).toMatchObject({
      paymentId,
      bankAccount: "NuConta",
      value: -120.25,
    });
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  test("does not attempt a partial edit or delete when a transfer's other entry is missing", async () => {
    const { gateway, batchUpdate } = setup([
      row("NuConta", "-100,25", `the-chatbot:transfer:${transfer.id}`),
    ]);
    await expect(gateway.saveTransfer(transfer, true)).rejects.toThrow(
      ValidationException,
    );
    await expect(gateway.deleteTransfer(transfer, transfer.id)).rejects.toThrow(
      ValidationException,
    );
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});
