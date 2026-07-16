import { ZodError } from "zod";
import type { Chat } from "~/modules/chat/entities/Chat";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import type {
  Message,
  ToolCallContent,
  ToolResultContent,
} from "~/modules/chat/entities/Message";
import type { AiToolDefinitionDTO } from "~/modules/chat/gateway/AiChatGateway";
import { AppError } from "~/shared/errors/ApplicationErrors";

export interface AiToolContext {
  chat: Chat;
  sourceMessage: Message;
}

export interface RegisteredTool extends AiToolDefinitionDTO {
  mutating: boolean;
  run(args: unknown, context: AiToolContext): Promise<unknown>;
}

export class ToolExecutor {
  constructor(private tools: RegisteredTool[] = []) {}

  protected setTools(tools: RegisteredTool[]): void {
    this.tools = tools;
  }

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
      if (error instanceof AppError && error.statusCode < 500) {
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
