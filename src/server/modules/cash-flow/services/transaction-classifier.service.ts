import { ZodError, z } from "zod";
import { ValidationException } from "~/domain/shared/domain-errors";
import type {
  AiChatGateway,
  AiModelSelectionDTO,
} from "~/server/modules/chat/gateways/ai-chat";
import {
  PromptLoader,
  PromptLocale,
} from "~/server/modules/chat/utils/prompt-loader";
import { AppError } from "~/server/shared/errors/application-errors";

export class TransactionClassifierService {
  constructor(private aiChatGateway: AiChatGateway) {}

  async classifyTransaction(
    type: string,
    userMessage: string,
    value: number,
    categories: string[],
    bankAccounts: string[],
    idUser: string,
    model?: AiModelSelectionDTO,
  ) {
    const schema = z
      .object({
        category: z
          .string()
          .refine((category) => categories.includes(category)),
        bank_account: z
          .string()
          .refine((account) => bankAccounts.includes(account)),
        description: z.string().trim().min(1),
      })
      .strict();
    return this.generateClassification(
      PromptLoader.getTransactionClassification(PromptLocale.PtBr),
      JSON.stringify({
        type,
        description: userMessage,
        value,
        categories,
        bankAccounts,
      }),
      schema,
      "Could not determine classification or bank account.",
      idUser,
      model ?? this.aiChatGateway.getDefaultModel(),
    );
  }

  async classifyTransfer(
    userMessage: string,
    value: number,
    bankAccounts: string[],
    idUser: string,
    model?: AiModelSelectionDTO,
  ) {
    const schema = z
      .object({
        from: z.string().refine((account) => bankAccounts.includes(account)),
        to: z.string().refine((account) => bankAccounts.includes(account)),
        description: z.string().trim().min(1),
      })
      .strict()
      .refine((classification) => classification.from !== classification.to, {
        message: "Source and destination bank accounts must differ",
      });
    return this.generateClassification(
      PromptLoader.getTransferClassification(PromptLocale.PtBr),
      JSON.stringify({
        type: "Transfer",
        description: userMessage,
        value,
        bankAccounts,
      }),
      schema,
      "Could not determine transfer classification.",
      idUser,
      model ?? this.aiChatGateway.getDefaultModel(),
    );
  }

  private async generateClassification<T>(
    prompt: string,
    payload: string,
    schema: z.ZodType<T>,
    failureMessage: string,
    idUser: string,
    model: AiModelSelectionDTO,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.aiChatGateway.generateText(
          idUser,
          model,
          prompt,
          payload,
        );
        const json = response
          .replace(/^\s*```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "");
        return schema.parse(JSON.parse(json));
      } catch (ex) {
        const status =
          ex && typeof ex === "object" && "status" in ex
            ? Number(ex.status)
            : undefined;
        const retryable =
          ex instanceof SyntaxError ||
          ex instanceof ZodError ||
          status === 429 ||
          (status !== undefined && status >= 500) ||
          (ex instanceof AppError && ex.statusCode >= 500);
        if (!retryable || attempt === 2) {
          throw new ValidationException(failureMessage);
        }
      }
    }
    throw new ValidationException(failureMessage);
  }
}
