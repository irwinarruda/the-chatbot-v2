import { z } from "zod";

export const MCP_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

export const LATEST_MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
} as const;
export type JsonRpcErrorCode = ValueOf<typeof JsonRpcErrorCode>;

export const JsonRpcIdDTO = z.union([z.string(), z.number().int()]);
export type JsonRpcIdDTO = z.infer<typeof JsonRpcIdDTO>;

export const JsonRpcRequestDTO = z.object({
  jsonrpc: z.literal("2.0"),
  id: JsonRpcIdDTO.optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type JsonRpcRequestDTO = z.infer<typeof JsonRpcRequestDTO>;

export const JsonRpcResponseDTO = z.union([
  z.object({
    jsonrpc: z.literal("2.0"),
    id: JsonRpcIdDTO,
    result: z.record(z.string(), z.unknown()),
  }),
  z.object({
    jsonrpc: z.literal("2.0"),
    id: JsonRpcIdDTO.nullable(),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
    }),
  }),
]);
export type JsonRpcResponseDTO = z.infer<typeof JsonRpcResponseDTO>;

export const McpInitializeParamsDTO = z.object({
  protocolVersion: z.string().min(1),
});
export type McpInitializeParamsDTO = z.infer<typeof McpInitializeParamsDTO>;

export const McpToolCallParamsDTO = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});
export type McpToolCallParamsDTO = z.infer<typeof McpToolCallParamsDTO>;

export const McpToolCallResultDTO = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  isError: z.boolean(),
});
export type McpToolCallResultDTO = z.infer<typeof McpToolCallResultDTO>;

export function isSupportedMcpProtocolVersion(version: string): boolean {
  return MCP_PROTOCOL_VERSIONS.some((supported) => supported === version);
}
