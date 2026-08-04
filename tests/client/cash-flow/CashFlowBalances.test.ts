import { describe, expect, test } from "vitest";
import { calculateCashFlowNetBalance } from "~/modules/cash-flow/client/CashFlowBalances";

describe("CashFlowBalances", () => {
  test("calculates net balance from current account balances", () => {
    const netBalance = calculateCashFlowNetBalance([
      { bankAccount: "NuConta", balance: 4.42 },
      { bankAccount: "Caixinha Nubank", balance: 45_350 },
      { bankAccount: "Crédito Nubank", balance: -4_629.2 },
      { bankAccount: "Crédito Mercado Pago", balance: -1_566.89 },
      { bankAccount: "Caju", balance: 5.73 },
    ]);

    expect(netBalance).toBeCloseTo(39_164.06);
  });
});
