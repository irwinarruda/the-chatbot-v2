import type { PayMonthlyExpenseRequestDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { CashFlowService } from "./CashFlowService";
import type { MonthlyExpenseService } from "./MonthlyExpenseService";

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
    return this.monthlyExpenses.setMonthlyExpensePaid(
      idUser,
      id,
      true,
      dto.month,
      transaction.date,
    );
  }
}
