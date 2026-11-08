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

export interface AiToolContext {
  chat: Chat;
  sourceMessage: Message;
  model?: AiModelSelectionDTO;
}

export type ToolRoundData = (
  context: AiToolContext,
) => Promise<Record<string, unknown>>;

export interface RegisteredTool extends AiToolDefinitionDTO {
  mutating: boolean;
  isParallelSafe?: boolean;
  afterRound?: ToolRoundData;
  run(args: unknown, context: AiToolContext): Promise<unknown>;
}

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
    const results = calls.every((call) => this.canRunInParallel(call))
      ? await Promise.all(calls.map((call) => this.execute(call, context)))
      : await this.executeInOrder(calls, context);
    return await this.addRoundData(calls, results, context);
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

  private canRunInParallel(call: ToolCallContent): boolean {
    const tool = this.findTool(call.name);
    if (!tool?.mutating) return true;
    return tool.isParallelSafe === true;
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

  private async addRoundData(
    calls: ToolCallContent[],
    results: ToolResultContent[],
    context: AiToolContext,
  ): Promise<ToolResultContent[]> {
    const loaders = new Set<ToolRoundData>();
    for (const [index, call] of calls.entries()) {
      const afterRound = this.findTool(call.name)?.afterRound;
      if (
        afterRound &&
        results[index].outcome.status === ToolResultStatus.Succeeded
      ) {
        loaders.add(afterRound);
      }
    }
    const roundData = new Map<ToolRoundData, Record<string, unknown>>();
    for (const loader of loaders) {
      const data = await this.loadRoundData(loader, context);
      if (data) roundData.set(loader, data);
    }
    return results.map((result, index) => {
      const afterRound = this.findTool(calls[index].name)?.afterRound;
      const data = afterRound ? roundData.get(afterRound) : undefined;
      const outcome = result.outcome;
      if (
        !data ||
        outcome.status !== ToolResultStatus.Succeeded ||
        !isRecord(outcome.data)
      ) {
        return result;
      }
      return {
        ...result,
        outcome: { ...outcome, data: { ...outcome.data, ...data } },
      };
    });
  }

  private async loadRoundData(
    loader: ToolRoundData,
    context: AiToolContext,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      return await loader(context);
    } catch {
      return undefined;
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

export function parseToolDate(date?: string): Date | undefined {
  return date ? new Date(`${date}T12:00:00.000Z`) : undefined;
}
