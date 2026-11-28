import { z } from "zod";
import {
  isSupportedMcpProtocolVersion,
  JsonRpcErrorCode,
  type JsonRpcIdDTO,
  type JsonRpcRequestDTO,
  type JsonRpcResponseDTO,
  LATEST_MCP_PROTOCOL_VERSION,
  McpInitializeParamsDTO,
  McpToolCallParamsDTO,
  type McpToolCallResultDTO,
} from "~/contracts/http/mcp/json-rpc";
import {
  toJsonRpcError,
  toJsonRpcResult,
} from "~/contracts/http/mcp/json-rpc-mapper";
import { ChatbotGuideToolDTO } from "~/contracts/tools/mcp/chatbot-guide";
import { ChatbotOperationToolDTO } from "~/contracts/tools/mcp/chatbot-operation";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolRisk, type ToolTopic } from "~/domain/chat/tool-exposure";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import type {
  ExternalToolDefinitionDTO,
  ToolExecutor,
} from "~/server/modules/chat/services/tool-executor.service";

export interface McpRequestContext {
  idUser: string;
  publicOrigin: string;
}

const GUIDE_TOOL = "chatbot_guide";

const OPERATION_TOOLS = {
  chatbot_read: ToolRisk.Read,
  chatbot_write: ToolRisk.Write,
  chatbot_destructive: ToolRisk.Destructive,
} as const satisfies Record<string, ToolRisk>;
type OperationToolName = keyof typeof OPERATION_TOOLS;

const TOOL_BY_RISK: Record<ToolRisk, OperationToolName> = {
  [ToolRisk.Read]: "chatbot_read",
  [ToolRisk.Write]: "chatbot_write",
  [ToolRisk.Destructive]: "chatbot_destructive",
};

const OPERATION_TOOL_COPY: Record<
  OperationToolName,
  { title: string; summary: string }
> = {
  chatbot_read: {
    title: "The Chatbot: read",
    summary: "Run a read-only The Chatbot operation. It never changes data.",
  },
  chatbot_write: {
    title: "The Chatbot: write",
    summary:
      "Run a The Chatbot operation that creates or changes data and can be undone by another write.",
  },
  chatbot_destructive: {
    title: "The Chatbot: destructive",
    summary:
      "Run a The Chatbot operation that permanently deletes data. Confirm with the user before calling it.",
  },
};

const SERVER_INSTRUCTIONS = [
  "The Chatbot is the user's personal assistant backend: finance records, monthly bills, notes, todos and HTML artifacts.",
  "Before the first operation of a topic in a conversation, call chatbot_guide with that topic to learn the operation names and input schemas.",
  "Then call chatbot_read, chatbot_write or chatbot_destructive with { operation, input }. The tool must match the operation's risk.",
].join("\n");

export class McpService {
  constructor(private readonly tools: ToolExecutor) {}

  async handleMessage(
    request: JsonRpcRequestDTO,
    context: McpRequestContext,
  ): Promise<JsonRpcResponseDTO | undefined> {
    const { id, method, params } = request;
    if (id === undefined) return undefined;
    if (method === "initialize") return this.initialize(id, params);
    if (method === "ping") return toJsonRpcResult(id, {});
    if (method === "tools/list") {
      return toJsonRpcResult(id, { tools: this.listTools() });
    }
    if (method === "tools/call") return this.callTool(id, params, context);
    return toJsonRpcError(
      id,
      JsonRpcErrorCode.MethodNotFound,
      `Method not found: ${method}`,
    );
  }

  private initialize(id: JsonRpcIdDTO, params: unknown): JsonRpcResponseDTO {
    const parsed = McpInitializeParamsDTO.safeParse(params);
    if (!parsed.success) {
      return toJsonRpcError(
        id,
        JsonRpcErrorCode.InvalidParams,
        "initialize requires protocolVersion",
      );
    }
    const requested = parsed.data.protocolVersion;
    return toJsonRpcResult(id, {
      protocolVersion: isSupportedMcpProtocolVersion(requested)
        ? requested
        : LATEST_MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "the-chatbot",
        title: "The Chatbot",
        version: "1.0.0",
      },
      instructions: SERVER_INSTRUCTIONS,
    });
  }

  private listTools() {
    const definitions = this.tools.getExternalDefinitions();
    const guide = {
      name: GUIDE_TOOL,
      title: "The Chatbot: guide",
      description: [
        "Learn the operations of one The Chatbot topic: each operation's name, which tool runs it, what it does and its input JSON Schema.",
        "Call it before the first operation of a topic in a conversation.",
      ].join("\n"),
      inputSchema: toInputJsonSchema(ChatbotGuideToolDTO),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    };
    const operationTools = Object.entries(OPERATION_TOOLS).map(
      ([name, risk]) => {
        const copy = OPERATION_TOOL_COPY[name as OperationToolName];
        const operations = definitions
          .filter((definition) => definition.exposure.risk === risk)
          .map((definition) => definition.name);
        return {
          name,
          title: copy.title,
          description: [
            copy.summary,
            `Operations: ${operations.join(", ")}.`,
            "Call chatbot_guide first to learn each operation's input.",
          ].join("\n"),
          inputSchema: toInputJsonSchema(ChatbotOperationToolDTO),
          annotations: {
            readOnlyHint: risk === ToolRisk.Read,
            destructiveHint: risk === ToolRisk.Destructive,
            idempotentHint: risk === ToolRisk.Read,
            openWorldHint: false,
          },
        };
      },
    );
    return [guide, ...operationTools];
  }

  private async callTool(
    id: JsonRpcIdDTO,
    params: unknown,
    context: McpRequestContext,
  ): Promise<JsonRpcResponseDTO> {
    const parsed = McpToolCallParamsDTO.safeParse(params);
    if (!parsed.success) {
      return toJsonRpcError(
        id,
        JsonRpcErrorCode.InvalidParams,
        "tools/call requires a tool name",
      );
    }
    const { name, arguments: args = {} } = parsed.data;
    if (name === GUIDE_TOOL) return toJsonRpcResult(id, this.guide(args));
    if (isOperationTool(name)) {
      return toJsonRpcResult(
        id,
        await this.runOperation(OPERATION_TOOLS[name], args, context),
      );
    }
    return toJsonRpcError(
      id,
      JsonRpcErrorCode.InvalidParams,
      `Unknown tool: ${name}`,
    );
  }

  private guide(args: unknown): McpToolCallResultDTO {
    const parsed = ChatbotGuideToolDTO.safeParse(args);
    if (!parsed.success) {
      return toolError({
        code: "InvalidArguments",
        message:
          "Send { topic } with one of: general, finance, bills, notes, todos, artifacts.",
      });
    }
    const topic = parsed.data.topic;
    return toolResult({
      topic,
      usage:
        "Call the tool named in each operation with { operation, input }, where input matches inputSchema.",
      operations: this.operationsOf(topic).map((definition) => ({
        operation: definition.name,
        tool: TOOL_BY_RISK[definition.exposure.risk],
        description: definition.description,
        inputSchema: toInputJsonSchema(definition.inputSchema),
      })),
    });
  }

  private async runOperation(
    risk: ToolRisk,
    args: unknown,
    context: McpRequestContext,
  ): Promise<McpToolCallResultDTO> {
    const parsed = ChatbotOperationToolDTO.safeParse(args);
    if (!parsed.success) {
      return toolError({
        code: "InvalidArguments",
        message:
          "Send { operation, input } where input is an object. Call chatbot_guide to learn the operations.",
      });
    }
    const { operation, input } = parsed.data;
    const definition = this.tools
      .getExternalDefinitions()
      .find((candidate) => candidate.name === operation);
    if (!definition) {
      return toolError({
        code: "UnknownOperation",
        message: `Unknown operation: ${operation}. Operations for ${TOOL_BY_RISK[risk]}: ${this.operationNames(risk).join(", ")}.`,
      });
    }
    if (definition.exposure.risk !== risk) {
      return toolError({
        code: "WrongTool",
        message: `${operation} is a ${definition.exposure.risk} operation. Call ${TOOL_BY_RISK[definition.exposure.risk]} instead.`,
      });
    }
    const [result] = await this.tools.executeRound(
      [
        {
          type: MessageContentType.ToolCall,
          callId: operation,
          name: operation,
          arguments: input,
        },
      ],
      { idUser: context.idUser, publicOrigin: context.publicOrigin },
    );
    const outcome = result.outcome;
    if (outcome.status === ToolResultStatus.Succeeded) {
      return toolResult(outcome.data ?? {});
    }
    if (outcome.status === ToolResultStatus.Unknown) {
      return toolError({
        status: outcome.status,
        code: outcome.code,
        message: `${outcome.message} Check with a read operation before retrying.`,
      });
    }
    return toolError({
      status: outcome.status,
      code: outcome.code,
      message: outcome.message,
    });
  }

  private operationsOf(topic: ToolTopic): ExternalToolDefinitionDTO[] {
    return this.tools
      .getExternalDefinitions()
      .filter((definition) => definition.exposure.topic === topic);
  }

  private operationNames(risk: ToolRisk): string[] {
    return this.tools
      .getExternalDefinitions()
      .filter((definition) => definition.exposure.risk === risk)
      .map((definition) => definition.name);
  }
}

function isOperationTool(name: string): name is OperationToolName {
  return Object.hasOwn(OPERATION_TOOLS, name);
}

function toInputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _schema, ...jsonSchema } = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  });
  return jsonSchema;
}

function toolResult(data: unknown): McpToolCallResultDTO {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    isError: false,
  };
}

function toolError(error: Record<string, unknown>): McpToolCallResultDTO {
  return {
    content: [{ type: "text", text: JSON.stringify(error) }],
    isError: true,
  };
}
