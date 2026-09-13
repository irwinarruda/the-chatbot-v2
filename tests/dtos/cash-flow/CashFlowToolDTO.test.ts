import { AddTransactionToolDTO } from "~/modules/cash-flow/entities/dtos/AddTransactionToolDTO";
import { TransferBetweenBankAccountsToolDTO } from "~/modules/cash-flow/entities/dtos/TransferBetweenBankAccountsToolDTO";

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
