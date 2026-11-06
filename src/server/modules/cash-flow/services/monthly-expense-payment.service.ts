import type { PayMonthlyExpenseRequestDTO } from "~/contracts/http/cash-flow/monthly-expense";
import { ValidationException } from "~/domain/shared/domain-errors";
import { NotFoundException } from "~/server/shared/errors/application-errors";
import type { CashFlowService } from "./cash-flow.service";
import type { MonthlyExpenseService } from "./monthly-expense.service";

export class MonthlyExpensePaymentService {
  constructor(
    private monthlyExpenses: MonthlyExpenseService,
    private cashFlow: CashFlowService,
  ) {}

  async payFromAccount(
    idUser: string,
    phoneNumber: string,
    id: string,
    dto: PayMonthlyExpenseRequestDTO,
  ) {
    const items = await this.monthlyExpenses.listMonthlyExpenses(
      idUser,
      dto.month,
    );
    const item = items.find((entry) => entry.expense.id === id);
    if (!item) throw new NotFoundException("Monthly expense not found");
    if (!item.expense.expectedAmount) {
      throw new ValidationException(
        "Set the bill amount before paying from an account",
      );
    }
    const transaction = await this.cashFlow.payBill(
      {
        phoneNumber,
        bankAccount: dto.bankAccount,
        category: dto.category,
        date: new Date(`${dto.date}T12:00:00.000Z`),
        value: item.expense.expectedAmount,
        description: item.expense.name,
      },
      `${id}:${dto.month}`,
    );
    const recordedCategory = transaction.category.trim();
    const recordedAccount = transaction.bankAccount.trim();
    const category =
      recordedCategory && recordedCategory !== item.expense.category
        ? recordedCategory
        : undefined;
    const defaultBankAccount =
      recordedAccount && !item.expense.defaultBankAccount
        ? recordedAccount
        : undefined;
    if (category || defaultBankAccount) {
      await this.monthlyExpenses.saveMonthlyExpensePaymentDetails({
        idUser,
        id,
        month: dto.month,
        category,
        defaultBankAccount,
      });
    }
    return this.monthlyExpenses.setMonthlyExpensePaid(
      idUser,
      id,
      true,
      dto.month,
      transaction.date,
    );
  }
}
