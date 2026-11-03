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

export interface RegisteredTool extends AiToolDefinitionDTO {
  mutating: boolean;
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

  async execute(
    call: ToolCallContent,
    context: AiToolContext,
  ): Promise<ToolResultContent> {
    const tool = this.tools.find((candidate) => candidate.name === call.name);
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

export function parseToolDate(date?: string): Date | undefined {
  return date ? new Date(`${date}T12:00:00.000Z`) : undefined;
}
