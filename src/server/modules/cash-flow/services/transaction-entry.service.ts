import type { MonthlyExpenseItemDTO } from "~/domain/cash-flow/monthly-expense-commands";
import type { CashFlowService } from "~/server/modules/cash-flow/services/cash-flow.service";
import type { MonthlyExpenseService } from "~/server/modules/cash-flow/services/monthly-expense.service";
import type { TransactionClassifierService } from "~/server/modules/cash-flow/services/transaction-classifier.service";
import type { AiModelSelectionDTO } from "~/server/modules/chat/gateways/ai-chat";

export interface DescribedEntryDTO {
  idUser: string;
  phoneNumber: string;
  userMessage: string;
  date: Date;
  model?: AiModelSelectionDTO;
}

export interface DescribedTransactionDTO extends DescribedEntryDTO {
  type: "Expense" | "Earning";
  value: number;
}

export interface DescribedTransferDTO extends DescribedEntryDTO {
  value: number;
}

export interface DescribedBalanceDTO extends DescribedEntryDTO {
  currentBalance: number;
}

export class TransactionEntryService {
  constructor(
    private cashFlow: CashFlowService,
    private monthlyExpenses: MonthlyExpenseService,
    private classifier: TransactionClassifierService,
  ) {}

  async addTransaction(dto: DescribedTransactionDTO) {
    const [categories, bankAccounts] = await Promise.all([
      dto.type === "Expense"
        ? this.cashFlow.getExpenseCategories(dto.phoneNumber)
        : this.cashFlow.getEarningCategories(dto.phoneNumber),
      this.cashFlow.getBankAccount(dto.phoneNumber),
    ]);
    const parsed = await this.classifier.classifyTransaction(
      dto.type,
      dto.userMessage,
      dto.value,
      categories,
      bankAccounts,
      dto.idUser,
      dto.model,
    );
    const transaction = {
      phoneNumber: dto.phoneNumber,
      date: dto.date,
      value: dto.value,
      category: parsed.category,
      description: parsed.description,
      bankAccount: parsed.bank_account,
    };
    let unpaidMonthlyExpenses: MonthlyExpenseItemDTO[] = [];
    if (dto.type === "Expense") {
      await this.cashFlow.addExpense(transaction);
      const monthlyExpenses = await this.monthlyExpenses.listMonthlyExpenses(
        dto.idUser,
      );
      unpaidMonthlyExpenses = monthlyExpenses.filter((item) => !item.isPaid);
    } else {
      await this.cashFlow.addEarning(transaction);
    }
    return { ...transaction, unpaidMonthlyExpenses };
  }

  async transfer(dto: DescribedTransferDTO) {
    const bankAccounts = await this.cashFlow.getBankAccount(dto.phoneNumber);
    const parsed = await this.classifier.classifyTransfer(
      dto.userMessage,
      dto.value,
      bankAccounts,
      dto.idUser,
      dto.model,
    );
    const category = await this.cashFlow.transferBetweenBankAccounts({
      phoneNumber: dto.phoneNumber,
      date: dto.date,
      value: dto.value,
      description: parsed.description,
      from: parsed.from,
      to: parsed.to,
    });
    return {
      from: parsed.from,
      to: parsed.to,
      category,
      description: parsed.description,
      date: dto.date,
      value: dto.value,
    };
  }

  async syncBalance(dto: DescribedBalanceDTO): Promise<void> {
    const { categories, bankAccounts } =
      await this.cashFlow.getCategoriesAndBankAccounts(dto.phoneNumber);
    const parsed = await this.classifier.classifyTransaction(
      "Earning",
      dto.userMessage,
      dto.currentBalance,
      categories,
      bankAccounts,
      dto.idUser,
      dto.model,
    );
    await this.cashFlow.syncBankAccountBalance({
      phoneNumber: dto.phoneNumber,
      bankAccount: parsed.bank_account,
      currentBalance: dto.currentBalance,
      category: parsed.category,
      description: parsed.description,
      date: dto.date,
    });
  }
}
