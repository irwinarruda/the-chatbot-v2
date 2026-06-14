# Plan 004: Transfer Between Bank Accounts

## Problem

The user can currently add individual expenses and earnings, sync bank account
balances, and view account status — but there is no way to record a **transfer
of a fixed amount from one bank account to another**. This is the most common
use case for paying a credit card bill: the user moves money from a checking or
savings account (e.g. "NuConta") into a credit-card account (e.g.
"Crédito Nubank").

Today the user would need to manually issue two separate tool calls — one
expense on the source account and one earning on the destination account — which
is error-prone and unintuitive. The AI agent has no tool that encapsulates this
as a single atomic operation.

## Goal

Add a new `transfer` method to `CashFlowService` and a corresponding
`transfer_between_bank_accounts` AI tool definition so that a user can express
a transfer in a single message like:

> "Transfer 500 from NuConta to Crédito Nubank because of payment of credit
> card"

The system should:

1. Validate that both bank accounts exist in the user's spreadsheet.
2. Create **two spreadsheet entries** in the correct order:
   - An **expense** on the **source** (from) account for the transfer amount.
   - An **earning** on the **destination** (to) account for the same amount.
3. Classify category, description, and bank-account mapping via the existing
   LLM classification pipeline.
4. Return a confirmation with details of both entries.

## Architecture Overview

```
User message: "Transfer 500 from NuConta to Crédito Nubank"
  → AI Agent selects tool: transfer_between_bank_accounts
    → ai-chat-tools.executeTool("transfer_between_bank_accounts", args)
      → classifyWithRetry() → { category, from, to, description }
      → CashFlowService.transferBetweenBankAccounts(dto)
        → validateBankAccountsExist() → both accounts found in spreadsheet
        → CashFlowService.addExpense({ ..., bankAccount: from_account })
        → CashFlowService.addEarning({ ..., bankAccount: to_account })
```

No new gateway methods are needed — the feature composes existing `addExpense`
and `addEarning` calls inside the service layer.

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Service method name | `transferBetweenBankAccounts` | Verb-noun naming consistent with `addExpense`, `addEarning`, `syncBankAccountBalance` |
| DTO name | `CashFlowTransferDTO` | Mirrors `CashFlowAddExpenseDTO` naming convention |
| Gateway changes | None — reuse existing `addExpense` / `addEarning` | The transfer is a domain-level composition of two primitives; no new spreadsheet write patterns needed |
| Validation | Both bank accounts must exist in the spreadsheet | Prevents typos from creating phantom entries on unknown accounts; same validation pattern as `syncBankAccountBalance` |
| Transfer value | Always positive in the DTO; expense is `-value`, earning is `+value` | Existing `addExpense` negates the value internally; `addEarning` takes the absolute value |
| Category & description | Classified via LLM using the existing `classifyWithRetry` with a dedicated prompt variation | The transfer description should reflect the user's intent (e.g. "Pagamento do cartão Nubank") |
| AI tool parameter `from` / `to` | Extracted by the LLM from the user message alongside classification | The LLM already classifies bank account names; extend classification result to include both accounts |
| Classification prompt | Extend the `ClassificationResult` type to include `from` and `to` fields | A transfer needs two bank accounts resolved; the existing classification only returns one `bank_account` |
| Atomicity | Best-effort: if the second write fails, the first entry remains | Same pattern as `syncBankAccountBalance` — the Google Sheets API does not support transactions; document this limitation |
| Date | Single date for both entries | Transfers are instantaneous in the spreadsheet; the same date is applied to both the expense and earning |
| Ordering | Expense first, then earning | Reflects the real-world mental model: money leaves the source, then arrives at the destination |

## Detailed Design

### 1. New DTO: `CashFlowTransferDTO`

File: `src/server/services/CashFlowService.ts`

```typescript
export interface CashFlowTransferDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  from: string;
  to: string;
}
```

This mirrors the existing `CashFlowAddExpenseDTO` shape but has
`from` and `to` instead of a single `bankAccount`.

### 2. New Service Method: `transferBetweenBankAccounts`

File: `src/server/services/CashFlowService.ts`

Add to `CashFlowService`:

```typescript
async transferBetweenBankAccounts(transfer: CashFlowTransferDTO): Promise<void> {
  const { sheet, credential } = await this.getUserAndSheet(
    transfer.phoneNumber,
  );
  const bankAccounts = await this.spreadsheetResource.getBankAccount({
    sheetId: sheet.idSheet,
    sheetAccessToken: credential.accessToken,
  });
  this.validateBankAccountExists(
    transfer.from,
    bankAccounts,
    "Source",
  );
  this.validateBankAccountExists(
    transfer.to,
    bankAccounts,
    "Destination",
  );
  if (transfer.from === transfer.to) {
    throw new ValidationException(
      "Source and destination bank accounts cannot be the same",
      "The transfer must be between two different bank accounts.",
    );
  }
  if (transfer.value <= 0) {
    throw new ValidationException(
      "Transfer value must be a positive number",
      `Received: ${transfer.value}`,
    );
  }
  await this.addExpense({
    phoneNumber: transfer.phoneNumber,
    date: transfer.date,
    value: transfer.value,
    category: transfer.category,
    description: transfer.description,
    bankAccount: transfer.from,
  });
  await this.addEarning({
    phoneNumber: transfer.phoneNumber,
    date: transfer.date,
    value: transfer.value,
    category: transfer.category,
    description: transfer.description,
    bankAccount: transfer.to,
  });
}

private validateBankAccountExists(
  accountName: string,
  existingAccounts: string[],
  label: string,
): void {
  if (!existingAccounts.includes(accountName)) {
    throw new ValidationException(
      `${label} bank account "${accountName}" not found in the spreadsheet`,
      "Available accounts: " +
        existingAccounts.join(", ") +
        ". Make sure the account name matches exactly.",
    );
  }
}
```

**Design notes:**

- The method calls `this.addExpense` and `this.addEarning` (public methods on
  the same service) rather than calling the gateway directly. This reuses the
  existing user/sheet resolution and error handling in those methods.
- Because `addExpense` and `addEarning` each call `getUserAndSheet` internally,
  the sheet resolution happens three times (once in `transferBetweenBankAccounts`
  for validation, once in `addExpense`, and once in `addEarning`). This is
  acceptable because `getUserAndSheet` is lightweight (DB read + credential
  check) and keeps each public method independently correct. If performance
  becomes a concern, an internal overload that accepts pre-resolved sheet config
  can be introduced later.
- The `validateBankAccountExists` private helper is extracted because it is
  called twice (for source and destination). This follows the code style rule:
  "Extract a separate method only when the same logic is reused more than once."

### 3. Extended Classification Result

File: `src/server/resources/ai-chat-tools.ts`

The existing `ClassificationResult` interface:

```typescript
interface ClassificationResult {
  category: string;
  bank_account: string;
  description: string;
}
```

Add a new interface for transfer classification:

```typescript
interface TransferClassificationResult {
  category: string;
  from: string;
  to: string;
  description: string;
}
```

This is a separate type rather than making `ClassificationResult` a union, so
that the existing `classifyWithRetry` function remains untouched and no
downstream code breaks.

### 4. Transfer Classification Function

File: `src/server/resources/ai-chat-tools.ts`

Add a new `classifyTransferWithRetry` function. It follows the same retry
pattern as `classifyWithRetry` but returns a `TransferClassificationResult`:

```typescript
async function classifyTransferWithRetry(
  aiChatGateway: IAiChatGateway,
  phoneNumber: string,
  userMessage: string,
  value: number,
  bankAccounts: string[],
  attempt = 1,
): Promise<TransferClassificationResult> {
  try {
    const prompt = PromptLoader.getTransactionClassification(PromptLocale.PtBr);
    const payload = Printable.make({
      type: "Transfer",
      description: userMessage,
      value,
      categories: [],
      bankAccounts,
    });
    const messages: AiChatMessage[] = [
      { role: AiChatRole.System, type: AiChatMessageType.Text, text: prompt },
      { role: AiChatRole.User, type: AiChatMessageType.Text, text: payload },
    ];
    const response = await aiChatGateway.getResponse(
      phoneNumber,
      messages,
      false,
    );
    const result =
      Printable.convert<TransferClassificationResult>(response.text);
    if (!result)
      throw new ValidationException(
        "Converted LLM response returned no value",
      );
    return result;
  } catch (err) {
    if (attempt > 5) {
      const errMsg =
        err instanceof Error ? err.message + (err.stack ?? "") : String(err);
      throw new ValidationException(
        `Could not determine transfer classification. ${errMsg}`,
      );
    }
    return classifyTransferWithRetry(
      aiChatGateway,
      phoneNumber,
      userMessage,
      value,
      bankAccounts,
      attempt + 1,
    );
  }
}
```

**Note on classification prompt reuse:** The existing
`transaction-classification.pt-BR.md` prompt template is used, but the payload
sent to the LLM includes `type: "Transfer"` and an empty `categories` array.
The prompt must be reviewed to ensure the LLM understands the "Transfer" type
and returns both `from` and `to` fields. If the
existing prompt cannot handle this, a new dedicated prompt file
`transfer-classification.pt-BR.md` should be created and loaded via a new
`PromptLoader.getTransferClassification()` method.

### 5. AI Tool Definition

File: `src/server/resources/ai-chat-tools.ts`

Add to the `toolDefinitions` array:

```typescript
{
  name: "transfer_between_bank_accounts",
  description: `Transfer a fixed amount from one bank account to another. Creates two entries: an expense on the source account and an earning on the destination account. Category and bank accounts are automatically resolved via classification using available bank accounts. Use this for credit card payments or any movement of money between accounts. Returns { message, from, to, category, description, date, value }. ${genericError}`,
  parameters: {
    type: "object",
    properties: {
      phone_number: {
        type: "string",
        description: "User phone number in E.164 format",
      },
      user_message: {
        type: "string",
        description:
          "Full original user message text with all context and nuances; pass exactly what the user sent",
      },
      value: {
        type: "number",
        description: "Amount to transfer (positive number)",
      },
      date: {
        type: "string",
        description:
          "Optional ISO-8601 date (if not explicit, omit this field)",
      },
    },
    required: ["phone_number", "user_message", "value"],
  },
},
```

**Note on parameters:** The tool does NOT accept `from` or `to` as explicit
parameters. The LLM classification resolves these from the user message text
and the available bank accounts list, consistent with how the existing
`add_transaction` tool resolves `bank_account` and `category`.

If after testing the LLM struggles to extract both bank accounts from free text,
the tool parameters can be extended to include optional `from` and `to` hints
that the LLM fills from its understanding of the user message, with the
classification step validating against the known accounts.

### 6. Tool Execution Handler

File: `src/server/resources/ai-chat-tools.ts`

Add a new case in the `executeTool` switch:

```typescript
case "transfer_between_bank_accounts": {
  const phoneNumber = args.phone_number as string;
  const userMessage = args.user_message as string;
  const value = args.value as number;
  const date = args.date ? new Date(args.date as string) : new Date();

  const { bankAccounts } =
    await cashFlowService.getCategoriesAndBankAccounts(phoneNumber);

  const parsed = await classifyTransferWithRetry(
    aiChatGateway,
    phoneNumber,
    userMessage,
    value,
    bankAccounts,
  );

  await cashFlowService.transferBetweenBankAccounts({
    phoneNumber,
    date,
    value,
    category: parsed.category,
    description: parsed.description,
    from: parsed.from,
    to: parsed.to,
  });

  return Printable.make({
    message: "Transfer completed successfully",
    from: parsed.from,
    to: parsed.to,
    category: parsed.category,
    description: parsed.description,
    date,
    value,
  });
}
```

### 7. No Bootstrap or Orquestrator Changes

`CashFlowService` is already registered in both `infra/bootstrap.ts` and
`tests/orquestrator.ts`. Since no new dependencies are injected and no new
gateway is introduced, **zero changes** are needed to the DI container, the
orquestrator, or the bootstrap wiring.

### 8. No Migration Changes

The transfer does not introduce any new database tables or columns. It writes
two rows into the same Google Sheets "Diário" sheet using existing
`addExpense` and `addEarning` methods. **No database migration is needed.**

## Classification Prompt Considerations

The existing `transaction-classification.pt-BR.md` prompt template is designed
to return:

```json
{
  "category": "...",
  "bank_account": "...",
  "description": "..."
}
```

For transfers, the classification needs to return:

```json
{
  "category": "...",
  "from": "...",
  "to": "...",
  "description": "..."
}
```

There are two approaches:

### Option A: Extend the existing prompt

Modify `transaction-classification.pt-BR.md` to also handle the "Transfer" type
and instruct the LLM to return `from` and `to` when the type is "Transfer". The `classifyTransferWithRetry` function would pass
`type: "Transfer"` and the prompt would conditionally request the right fields.

### Option B: Create a dedicated transfer prompt

Create a new file `transfer-classification.pt-BR.md` with instructions
specifically crafted for transfer classification. Add a new
`PromptLoader.getTransferClassification()` method.

**Recommendation:** Option B is preferred. It avoids risking regression in the
existing classification behavior and allows the transfer prompt to be
specifically tuned for extracting source and destination accounts. The prompt
should:

1. Explain that the user wants to transfer money between accounts.
2. List the available bank accounts.
3. Ask the LLM to identify which account is the source (money leaving) and
   which is the destination (money arriving).
4. Ask for a category (likely something like "Transferência" or the user's
   stated reason).
5. Ask for a concise description in the user's language.

File: `src/server/utils/PromptLoader.ts` — add:

```typescript
static getTransferClassification(locale: PromptLocale): string {
  const fileBase =
    `transfer-classification${PromptLoader.localeToFileSuffix(locale)}`;
  return PromptLoader.readFile(fileBase);
}
```

File: `infra/templates/prompts/transfer-classification.pt-BR.md` — create:

A prompt template instructing the LLM to classify transfer operations. It
should request a JSON response with `category`, `from`, `to`, and `description`
fields.

## Test Cases

All tests go in `tests/CashFlowService.test.ts` following the existing test
patterns.

### Test Suite: `transferBetweenBankAccounts`

#### Setup Helper

Add a helper that creates a user with a spreadsheet and seeds initial balances:

```typescript
async function setupUserWithBalances(
  phoneNumber: string,
  date: Date,
  balances: { bankAccount: string; amount: number }[],
) {
  await setupUserWithSpreadsheet(phoneNumber);
  await withEmptySpreadsheet(phoneNumber, async () => {
    for (const { bankAccount, amount } of balances) {
      if (amount >= 0) {
        await orquestrator.cashFlowService.addEarning({
          phoneNumber,
          date,
          value: amount,
          category: "Salário",
          description: `Initial balance for ${bankAccount}`,
          bankAccount,
        });
      } else {
        await orquestrator.cashFlowService.addExpense({
          phoneNumber,
          date,
          value: Math.abs(amount),
          category: "Delivery",
          description: `Initial balance for ${bankAccount}`,
          bankAccount,
        });
      }
    }
  });
}
```

#### TC-001: Basic transfer between two accounts

**Purpose:** Verify that a transfer creates two entries and updates both account
balances correctly.

```
Given a user with a spreadsheet
  And NuConta has a balance of 1000
  And "Crédito Nubank" has a balance of 0
When transferBetweenBankAccounts is called with:
  - from: "NuConta"
  - to: "Crédito Nubank"
  - value: 500
  - category: "Cartão de Crédito"
  - description: "Pagamento cartão Nubank"
  - date: today
Then two transactions should be created:
  1. Expense on NuConta for 500
  2. Earning on "Crédito Nubank" for 500
And NuConta balance should be 500
And "Crédito Nubank" balance should be 500
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should create expense and earning entries", async () => {
  const phoneNumber = "5511910000001";
  await setupUserWithSpreadsheet(phoneNumber);

  await withEmptySpreadsheet(phoneNumber, async () => {
    const date = new Date(2025, 10, 15);

    // Setup initial balances
    await orquestrator.cashFlowService.addEarning({
      phoneNumber,
      date,
      value: 1000,
      category: "Salário",
      description: "Initial NuConta balance",
      bankAccount: "NuConta",
    });

    await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 1000 },
    ]);

    // Execute transfer
    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date,
      value: 500,
      category: "Cartão de Crédito",
      description: "Pagamento cartão Nubank",
      from: "NuConta",
      to: "Caju",
    });

    // Verify final balances
    const status = await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 500 },
      { bankAccount: "Caju", balance: 500 },
    ]);
    expectBankAccountsStatusToEqual(status, [
      { bankAccount: "NuConta", balance: 500 },
      { bankAccount: "Caju", balance: 500 },
    ]);

    // Verify two transactions were created
    const transactions =
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
    expect(transactions.length).toBe(3); // 1 initial earning + 1 expense + 1 earning
    const lastTwo = transactions.slice(-2);
    expect(lastTwo[0].value).toBe(-500); // expense
    expect(lastTwo[0].bankAccount).toBe("NuConta");
    expect(lastTwo[1].value).toBe(500); // earning
    expect(lastTwo[1].bankAccount).toBe("Caju");
  });
});
```

#### TC-002: Transfer with non-existent source account

**Purpose:** Verify that the service rejects transfers when the source account
does not exist.

```
Given a user with a spreadsheet
  And bank accounts are ["NuConta", "Caju"]
When transferBetweenBankAccounts is called with:
  - from: "NonExistentAccount"
  - to: "NuConta"
  - value: 100
Then it should throw ValidationException
  with message containing "Source bank account "NonExistentAccount" not found"
And no transactions should be created
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should reject non-existent source account", async () => {
  const phoneNumber = "5511910000002";
  await setupUserWithSpreadsheet(phoneNumber);

  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Test transfer",
      from: "NonExistentAccount",
      to: "NuConta",
    }),
  ).rejects.toThrow(ValidationException);
});
```

#### TC-003: Transfer with non-existent destination account

**Purpose:** Verify that the service rejects transfers when the destination
account does not exist.

```
Given a user with a spreadsheet
  And bank accounts are ["NuConta", "Caju"]
When transferBetweenBankAccounts is called with:
  - from: "NuConta"
  - to: "NonExistentAccount"
  - value: 100
Then it should throw ValidationException
  with message containing "Destination bank account "NonExistentAccount" not found"
And no transactions should be created
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should reject non-existent destination account", async () => {
  const phoneNumber = "5511910000003";
  await setupUserWithSpreadsheet(phoneNumber);

  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Test transfer",
      from: "NuConta",
      to: "NonExistentAccount",
    }),
  ).rejects.toThrow(ValidationException);
});
```

#### TC-004: Transfer between same account

**Purpose:** Verify that the service rejects transfers where source and
destination are the same account.

```
Given a user with a spreadsheet
When transferBetweenBankAccounts is called with:
  - from: "NuConta"
  - to: "NuConta"
  - value: 100
Then it should throw ValidationException
  with message "Source and destination bank accounts cannot be the same"
And no transactions should be created
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should reject same source and destination", async () => {
  const phoneNumber = "5511910000004";
  await setupUserWithSpreadsheet(phoneNumber);

  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Same account transfer",
      from: "NuConta",
      to: "NuConta",
    }),
  ).rejects.toThrow(ValidationException);
});
```

#### TC-005: Transfer with zero or negative value

**Purpose:** Verify that the service rejects transfers with non-positive values.

```
Given a user with a spreadsheet
When transferBetweenBankAccounts is called with value: 0
Then it should throw ValidationException
  with message "Transfer value must be a positive number"

When transferBetweenBankAccounts is called with value: -50
Then it should throw ValidationException
  with message "Transfer value must be a positive number"
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should reject zero or negative value", async () => {
  const phoneNumber = "5511910000005";
  await setupUserWithSpreadsheet(phoneNumber);

  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(),
      value: 0,
      category: "Transferência",
      description: "Zero transfer",
      from: "NuConta",
      to: "Caju",
    }),
  ).rejects.toThrow(ValidationException);

  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(),
      value: -50,
      category: "Transferência",
      description: "Negative transfer",
      from: "NuConta",
      to: "Caju",
    }),
  ).rejects.toThrow(ValidationException);
});
```

#### TC-006: Transfer without user or spreadsheet

**Purpose:** Verify that the existing auth/spsheet validation guards work for
the transfer method.

```
When transferBetweenBankAccounts is called for a non-existent user
Then it should throw NotFoundException ("User was not found")

Given a user without Google connection
When transferBetweenBankAccounts is called
Then it should throw ValidationException ("User is not connected to Google")

Given a user with Google but no spreadsheet
When transferBetweenBankAccounts is called
Then it should throw ValidationException ("User does not have a financial planning spreadsheet configured")
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should validate user and spreadsheet existence", async () => {
  // Non-existent user
  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber: "5511900099999",
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Test",
      from: "NuConta",
      to: "Caju",
    }),
  ).rejects.toThrow(NotFoundException);

  // User without Google
  const noGooglePhone = "5511910000006";
  await orquestrator.createUser({ phoneNumber: noGooglePhone });
  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber: noGooglePhone,
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Test",
      from: "NuConta",
      to: "Caju",
    }),
  ).rejects.toThrow(ValidationException);

  // User with Google but no spreadsheet
  const noSheetPhone = "5511910000007";
  await createGoogleConnectedUser(noSheetPhone);
  await expect(
    orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber: noSheetPhone,
      date: new Date(),
      value: 100,
      category: "Transferência",
      description: "Test",
      from: "NuConta",
      to: "Caju",
    }),
  ).rejects.toThrow(ValidationException);
});
```

#### TC-007: Multiple transfers accumulate correctly

**Purpose:** Verify that successive transfers correctly accumulate on both
accounts.

```
Given a user with a spreadsheet
  And NuConta has a balance of 1000
  And Caju has a balance of 0
When transfer of 200 from NuConta to Caju
Then NuConta = 800, Caju = 200
When transfer of 300 from NuConta to Caju
Then NuConta = 500, Caju = 500
When transfer of 100 from Caju to NuConta (reverse direction)
Then NuConta = 600, Caju = 400
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should accumulate multiple transfers correctly", async () => {
  const phoneNumber = "5511910000008";
  await setupUserWithSpreadsheet(phoneNumber);

  await withEmptySpreadsheet(phoneNumber, async () => {
    const date = new Date(2025, 10, 15);

    await orquestrator.cashFlowService.addEarning({
      phoneNumber,
      date,
      value: 1000,
      category: "Salário",
      description: "Initial balance",
      bankAccount: "NuConta",
    });

    await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 1000 },
    ]);

    // Transfer 1: NuConta -> Caju
    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date,
      value: 200,
      category: "Transferência",
      description: "First transfer",
      from: "NuConta",
      to: "Caju",
    });

    let status = await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 800 },
      { bankAccount: "Caju", balance: 200 },
    ]);
    expectBankAccountsStatusToEqual(status, [
      { bankAccount: "NuConta", balance: 800 },
      { bankAccount: "Caju", balance: 200 },
    ]);

    // Transfer 2: NuConta -> Caju
    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date,
      value: 300,
      category: "Transferência",
      description: "Second transfer",
      from: "NuConta",
      to: "Caju",
    });

    status = await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 500 },
      { bankAccount: "Caju", balance: 500 },
    ]);
    expectBankAccountsStatusToEqual(status, [
      { bankAccount: "NuConta", balance: 500 },
      { bankAccount: "Caju", balance: 500 },
    ]);

    // Transfer 3: Caju -> NuConta (reverse)
    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date,
      value: 100,
      category: "Transferência",
      description: "Reverse transfer",
      from: "Caju",
      to: "NuConta",
    });

    status = await getBankAccountsStatusEventually(phoneNumber, date, [
      { bankAccount: "NuConta", balance: 600 },
      { bankAccount: "Caju", balance: 400 },
    ]);
    expectBankAccountsStatusToEqual(status, [
      { bankAccount: "NuConta", balance: 600 },
      { bankAccount: "Caju", balance: 400 },
    ]);
  });
});
```

#### TC-008: Transfer preserves category and description on both entries

**Purpose:** Verify that both the expense and earning entries carry the same
category, description, and date.

```
Given a user with a spreadsheet
When transferBetweenBankAccounts is called with:
  - category: "Cartão de Crédito"
  - description: "Pagamento fatura Nubank dezembro"
  - date: 2025-12-15
Then the expense entry should have:
  - category: "Cartão de Crédito"
  - description: "Pagamento fatura Nubank dezembro"
  - date: 2025-12-15
And the earning entry should have:
  - category: "Cartão de Crédito"
  - description: "Pagamento fatura Nubank dezembro"
  - date: 2025-12-15
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should preserve metadata on both entries", async () => {
  const phoneNumber = "5511910000009";
  await setupUserWithSpreadsheet(phoneNumber);

  await withEmptySpreadsheet(phoneNumber, async () => {
    const date = new Date(2025, 11, 15);

    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date,
      value: 750.5,
      category: "Cartão de Crédito",
      description: "Pagamento fatura Nubank dezembro",
      from: "NuConta",
      to: "Caju",
    });

    const transactions =
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
    expect(transactions.length).toBe(2);

    const expense = transactions[0];
    expect(expense.value).toBe(-750.5);
    expect(expense.category).toBe("Cartão de Crédito");
    expect(expense.description).toBe("Pagamento fatura Nubank dezembro");
    expect(expense.bankAccount).toBe("NuConta");
    expect(expense.date.getTime()).toBe(new Date(date.toDateString()).getTime());

    const earning = transactions[1];
    expect(earning.value).toBe(750.5);
    expect(earning.category).toBe("Cartão de Crédito");
    expect(earning.description).toBe("Pagamento fatura Nubank dezembro");
    expect(earning.bankAccount).toBe("Caju");
    expect(earning.date.getTime()).toBe(new Date(date.toDateString()).getTime());
  });
});
```

#### TC-009: Transfer with decimal amount

**Purpose:** Verify that fractional transfer amounts work correctly.

```
Given a user with a spreadsheet
When transferBetweenBankAccounts is called with value: 1234.56
Then the expense should be -1234.56
And the earning should be 1234.56
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should handle decimal amounts", async () => {
  const phoneNumber = "5511910000010";
  await setupUserWithSpreadsheet(phoneNumber);

  await withEmptySpreadsheet(phoneNumber, async () => {
    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: new Date(2025, 10, 15),
      value: 1234.56,
      category: "Cartão de Crédito",
      description: "Decimal transfer",
      from: "NuConta",
      to: "Caju",
    });

    const transactions =
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
    expect(transactions.length).toBe(2);
    expect(transactions[0].value).toBeCloseTo(-1234.56);
    expect(transactions[1].value).toBeCloseTo(1234.56);
  });
});
```

#### TC-010: Transfer on a specific date

**Purpose:** Verify that the date is correctly applied to both entries and the
bank account status is reflected in the correct month.

```
Given a user with a spreadsheet
When transferBetweenBankAccounts is called with date: 2025-11-20
Then the expense entry should have date: 2025-11-20
And the earning entry should have date: 2025-11-20
And bank account status for November 2025 should reflect the transfer
And bank account status for December 2025 should NOT reflect the transfer
```

**Test code sketch:**

```typescript
test("transferBetweenBankAccounts should apply correct date to both entries", async () => {
  const phoneNumber = "5511910000011";
  await setupUserWithSpreadsheet(phoneNumber);

  await withEmptySpreadsheet(phoneNumber, async () => {
    const transferDate = new Date(2025, 10, 20);

    await orquestrator.cashFlowService.transferBetweenBankAccounts({
      phoneNumber,
      date: transferDate,
      value: 300,
      category: "Transferência",
      description: "November transfer",
      from: "NuConta",
      to: "Caju",
    });

    const novemberStatus = await getBankAccountsStatusEventually(
      phoneNumber,
      new Date(2025, 10, 20),
      [
        { bankAccount: "NuConta", balance: -300 },
        { bankAccount: "Caju", balance: 300 },
      ],
    );
    expectBankAccountsStatusToEqual(novemberStatus, [
      { bankAccount: "NuConta", balance: -300 },
      { bankAccount: "Caju", balance: 300 },
    ]);

    const decemberStatus =
      await orquestrator.cashFlowService.getBankAccountsStatus(
        phoneNumber,
        new Date(2025, 11, 20),
      );
    expect(decemberStatus).toEqual([]);
  });
});
```

## Detailed Implementation Steps

### Step 1: Add `CashFlowTransferDTO` interface

File: `src/server/services/CashFlowService.ts`

- Add the `CashFlowTransferDTO` interface alongside the existing DTOs at the
  top of the file.
- Export it so `ai-chat-tools.ts` can import the type if needed.

### Step 2: Add `transferBetweenBankAccounts` method

File: `src/server/services/CashFlowService.ts`

- Add the public `transferBetweenBankAccounts` method to `CashFlowService`.
- Add the private `validateBankAccountExists` helper method.

### Step 3: Add classification types and function

File: `src/server/resources/ai-chat-tools.ts`

- Add the `TransferClassificationResult` interface.
- Add the `classifyTransferWithRetry` function.

### Step 4: Add `PromptLoader.getTransferClassification`

File: `src/server/utils/PromptLoader.ts`

- Add the `getTransferClassification` static method.

### Step 5: Create transfer classification prompt

File: `infra/templates/prompts/transfer-classification.pt-BR.md`

- Create the prompt file instructing the LLM to classify transfer operations.
- The prompt should request `from`, `to`, `category`,
  and `description` in the JSON response.
- Provide the list of available bank accounts.
- Instruct the LLM to identify the source account (money leaving) and the
  destination account (money arriving).

### Step 6: Add AI tool definition

File: `src/server/resources/ai-chat-tools.ts`

- Add the `transfer_between_bank_accounts` entry to the `toolDefinitions`
  array.

### Step 7: Add tool execution handler

File: `src/server/resources/ai-chat-tools.ts`

- Add the `case "transfer_between_bank_accounts":` block to the `executeTool`
  switch statement.

### Step 8: Add tests

File: `tests/CashFlowService.test.ts`

- Add the test suite with all test cases TC-001 through TC-010.

### Step 9: Verify

Run:

```bash
bun run typecheck
bun run check
bun run test
```

## File Change Summary

| File | Action | Description |
|---|---|---|
| `src/server/services/CashFlowService.ts` | Modify | Add `CashFlowTransferDTO`, `transferBetweenBankAccounts()`, `validateBankAccountExists()` |
| `src/server/resources/ai-chat-tools.ts` | Modify | Add `TransferClassificationResult`, `classifyTransferWithRetry()`, tool definition, and tool execution handler |
| `src/server/utils/PromptLoader.ts` | Modify | Add `getTransferClassification()` method |
| `infra/templates/prompts/transfer-classification.pt-BR.md` | Create | Transfer classification prompt template |
| `tests/CashFlowService.test.ts` | Modify | Add 10 test cases for `transferBetweenBankAccounts` |
| `infra/bootstrap.ts` | No change | Service already registered |
| `tests/orquestrator.ts` | No change | Service already registered |
| `src/server/resources/ICashFlowSpreadsheetGateway.ts` | No change | Reuses existing `addExpense`/`addEarning` |
| `src/server/resources/TestCashFlowSpreadsheetGateway.ts` | No change | Reuses existing `addExpense`/`addEarning` |
| `src/server/resources/GoogleCashFlowSpreadsheetGateway.ts` | No change | Reuses existing `addExpense`/`addEarning` |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Partial write: expense succeeds but earning fails, leaving an unbalanced state | Document this as a known limitation; user can use `deleteLastTransaction` to remove the orphaned expense and retry. A future enhancement could add a compensating write or manual cleanup tool. |
| LLM misclassifies source vs destination bank accounts | The tool execution handler passes `bankAccounts` list to classification; the prompt should explicitly ask which account sends and which receives. Validate both resolved names against the spreadsheet's known accounts. If classification fails after 5 retries, the error propagates to the user with a descriptive message. |
| Category for transfers may not exist in the spreadsheet | The `category` from classification must match an existing category. If it doesn't, the spreadsheet will still accept the write (the category column is free text in Google Sheets), but it may not roll up correctly in summary formulas. Consider adding a "Transferência" category to the spreadsheet template or instructing the LLM to pick an appropriate existing category. |
| Double `getUserAndSheet` resolution | The method resolves the sheet once for validation, then `addExpense` and `addEarning` each resolve it again. This is three DB reads per transfer. Acceptable for now since reads are fast. Can be optimized later with an internal overload. |
| Classification prompt may not handle all transfer phrasings | Test with varied user messages during development: "paguei o cartão", "transferir X de Y pra Z", "mover dinheiro", "pagamento de fatura", etc. Tune the prompt accordingly. |

## Completion Criteria

The feature is complete when:

- `CashFlowService.transferBetweenBankAccounts()` creates an expense on the
  source account and an earning on the destination account.
- Both bank accounts are validated against the spreadsheet before any writes.
- Same-account transfers, non-positive values, and non-existent accounts are
  rejected with clear `ValidationException` messages.
- The `transfer_between_bank_accounts` AI tool is registered and callable by the
  AI agent.
- The classification pipeline resolves `from` and `to`
  from the user's free-text message.
- All 10 test cases pass in the test suite.
- `bun run typecheck` and `bun run check` pass with no new errors.
