import {
  type JsonRpcErrorCode,
  type JsonRpcIdDTO,
  JsonRpcResponseDTO,
} from "./json-rpc";

export function toJsonRpcResult(
  id: JsonRpcIdDTO,
  result: Record<string, unknown>,
): JsonRpcResponseDTO {
  return JsonRpcResponseDTO.parse({ jsonrpc: "2.0", id, result });
}

export function toJsonRpcError(
  id: JsonRpcIdDTO | null,
  code: JsonRpcErrorCode,
  message: string,
): JsonRpcResponseDTO {
  return JsonRpcResponseDTO.parse({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}
