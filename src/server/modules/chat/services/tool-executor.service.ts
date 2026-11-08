import { ZodError } from "zod";
import type { Chat } from "~/domain/chat/chat";
import type {
  Message,
  ToolCallContent,
  ToolResultContent,
} from "~/domain/chat/message";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import type { User } from "~/domain/identity/user";
import { DomainError } from "~/domain/shared/domain-errors";
import type {
  AiModelSelectionDTO,
  AiToolDefinitionDTO,
} from "~/server/modules/chat/gateways/ai-chat";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import {
  AppError,
  UnauthorizedException,
} from "~/server/shared/errors/application-errors";

export type InCallOrder = <T>(write: () => Promise<T>) => Promise<T>;

export interface AiToolContext {
  chat: Chat;
  sourceMessage: Message;
  model?: AiModelSelectionDTO;
  inCallOrder?: InCallOrder;
}

export type AfterRoundLoader = (
  context: AiToolContext,
) => Promise<Record<string, unknown>>;

export interface RegisteredTool extends AiToolDefinitionDTO {
  mutating: boolean;
  isParallelSafe?: boolean;
  afterRound?: AfterRoundLoader;
  run(args: unknown, context: AiToolContext): Promise<unknown>;
}

const maximumParallelCalls = 4;
const afterRoundTimeoutMs = 5_000;

export class ToolExecutor {
  constructor(private tools: RegisteredTool[] = []) {}

  getDefinitions(): AiToolDefinitionDTO[] {
    return this.tools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  async executeRound(
    calls: ToolCallContent[],
    context: AiToolContext,
  ): Promise<ToolResultContent[]> {
    const results = this.canRunTogether(calls)
      ? await this.executeTogether(calls, context)
      : await this.executeInOrder(calls, context);
    return await this.addAfterRoundData(calls, results, context);
  }

  async execute(
    call: ToolCallContent,
    context: AiToolContext,
  ): Promise<ToolResultContent> {
    const tool = this.findTool(call.name);
    if (!tool) {
      return this.failedResult(
        call,
        "UnknownTool",
        `Unknown tool: ${call.name}`,
      );
    }
    try {
      const data = await tool.run(call.arguments ?? {}, context);
      return {
        type: MessageContentType.ToolResult,
        callId: call.callId,
        outcome: { status: ToolResultStatus.Succeeded, data },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return this.failedResult(
          call,
          "InvalidArguments",
          `Invalid arguments for ${call.name}: ${error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
      }
      if (
        error instanceof DomainError ||
        (error instanceof AppError && error.statusCode < 500)
      ) {
        return this.failedResult(call, error.name, error.message);
      }
      if (tool.mutating) {
        return {
          type: MessageContentType.ToolResult,
          callId: call.callId,
          outcome: {
            status: ToolResultStatus.Unknown,
            code: "UnconfirmedOutcome",
            message:
              "The operation may have completed, but its outcome could not be confirmed.",
          },
        };
      }
      return this.failedResult(
        call,
        "InternalError",
        "The tool could not be completed because of an internal error.",
      );
    }
  }

  private findTool(name: string): RegisteredTool | undefined {
    return this.tools.find((candidate) => candidate.name === name);
  }

  private canRunTogether(calls: ToolCallContent[]): boolean {
    const tools = calls.map((call) => this.findTool(call.name));
    const isRead = (tool?: RegisteredTool) => !tool?.mutating;
    const isParallelWrite = (tool?: RegisteredTool) =>
      tool?.mutating === true && tool.isParallelSafe === true;
    return tools.every(isRead) || tools.every(isParallelWrite);
  }

  private async executeTogether(
    calls: ToolCallContent[],
    context: AiToolContext,
  ): Promise<ToolResultContent[]> {
    const writeTurns = calls.map(() => createSignal());
    const results: ToolResultContent[] = [];
    let nextIndex = 0;
    const executeNext = async () => {
      while (nextIndex < calls.length) {
        const index = nextIndex++;
        const previousWrite = writeTurns[index - 1]?.done ?? Promise.resolve();
        const releaseWrite = () => {
          void previousWrite.then(writeTurns[index].release);
        };
        const inCallOrder: InCallOrder = async (write) => {
          await previousWrite;
          try {
            return await write();
          } finally {
            releaseWrite();
          }
        };
        try {
          results[index] = await this.execute(calls[index], {
            ...context,
            inCallOrder,
          });
        } finally {
          releaseWrite();
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(maximumParallelCalls, calls.length) },
        executeNext,
      ),
    );
    return results;
  }

  private async executeInOrder(
    calls: ToolCallContent[],
    context: AiToolContext,
  ): Promise<ToolResultContent[]> {
    const results: ToolResultContent[] = [];
    for (const call of calls) {
      results.push(await this.execute(call, context));
    }
    return results;
  }

  private async addAfterRoundData(
    calls: ToolCallContent[],
    results: ToolResultContent[],
    context: AiToolContext,
  ): Promise<ToolResultContent[]> {
    const loaders = results.map((result, index) =>
      result.outcome.status === ToolResultStatus.Succeeded &&
      isRecord(result.outcome.data)
        ? this.findTool(calls[index].name)?.afterRound
        : undefined,
    );
    const loaded = new Map<AfterRoundLoader, Record<string, unknown>>();
    for (const loader of new Set(loaders)) {
      if (!loader) continue;
      const data = await this.loadAfterRoundData(loader, context);
      if (data) loaded.set(loader, data);
    }
    return results.map((result, index) => {
      const loader = loaders[index];
      const data = loader ? loaded.get(loader) : undefined;
      const outcome = result.outcome;
      if (!data || outcome.status !== ToolResultStatus.Succeeded) return result;
      return {
        ...result,
        outcome: { ...outcome, data: { ...toRecord(outcome.data), ...data } },
      };
    });
  }

  private async loadAfterRoundData(
    loader: AfterRoundLoader,
    context: AiToolContext,
  ): Promise<Record<string, unknown> | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), afterRoundTimeoutMs);
      });
      return await Promise.race([loader(context), timeout]);
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private failedResult(
    call: ToolCallContent,
    code: string,
    message: string,
  ): ToolResultContent {
    return {
      type: MessageContentType.ToolResult,
      callId: call.callId,
      outcome: { status: ToolResultStatus.Failed, code, message },
    };
  }
}

export async function requireToolUser(
  authService: AuthService,
  context: AiToolContext,
): Promise<User> {
  if (!context.chat.idUser) {
    throw new UnauthorizedException("Authenticated user is required");
  }
  const user = await authService.getUserById(context.chat.idUser);
  if (!user) {
    throw new UnauthorizedException("Authenticated user was not found");
  }
  return user;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && Boolean(value) && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function createSignal() {
  let release = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { done, release };
}

export function parseToolDate(date?: string): Date | undefined {
  return date ? new Date(`${date}T12:00:00.000Z`) : undefined;
}
