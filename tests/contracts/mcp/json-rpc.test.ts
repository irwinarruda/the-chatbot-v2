import { describe, expect, test } from "vitest";
import {
  isSupportedMcpProtocolVersion,
  JsonRpcRequestDTO,
} from "~/contracts/http/mcp/json-rpc";
import { ChatbotOperationToolDTO } from "~/contracts/tools/mcp/chatbot-operation";

describe("MCP JSON-RPC contracts", () => {
  test("accepts a request and a notification", () => {
    expect(
      JsonRpcRequestDTO.parse({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    ).toEqual({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(
      JsonRpcRequestDTO.parse({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }).id,
    ).toBeUndefined();
  });

  test("rejects a message without the JSON-RPC version or a method", () => {
    expect(() => JsonRpcRequestDTO.parse({ id: 1, method: "ping" })).toThrow();
    expect(() => JsonRpcRequestDTO.parse({ jsonrpc: "2.0", id: 1 })).toThrow();
  });

  test("knows the supported protocol versions", () => {
    expect(isSupportedMcpProtocolVersion("2025-06-18")).toBe(true);
    expect(isSupportedMcpProtocolVersion("2024-11-05")).toBe(false);
  });

  test("defaults an operation input to an empty object and rejects a string input", () => {
    expect(ChatbotOperationToolDTO.parse({ operation: "list_todos" })).toEqual({
      operation: "list_todos",
      input: {},
    });
    expect(() =>
      ChatbotOperationToolDTO.parse({ operation: "list_todos", input: "{}" }),
    ).toThrow();
  });
});
