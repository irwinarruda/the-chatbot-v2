import { AddTransactionToolDTO } from "~/contracts/tools/cash-flow/add-transaction";
import { TransferBetweenBankAccountsToolDTO } from "~/contracts/tools/cash-flow/transfer-between-bank-accounts";

describe("CashFlowToolDTO", () => {
  test("tool DTOs reject invalid mutating arguments", () => {
    expect(() =>
      AddTransactionToolDTO.parse({
        type: "Expense",
        user_message: "invalid value",
        value: 0,
      }),
    ).toThrow();
    expect(() =>
      TransferBetweenBankAccountsToolDTO.parse({
        user_message: "invalid date",
        value: 10,
        date: "2026-02-30",
      }),
    ).toThrow();
  });
});
