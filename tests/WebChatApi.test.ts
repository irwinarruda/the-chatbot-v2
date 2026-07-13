import { describe, expect, test } from "vitest";
import {
  parseChatMessage,
  parseCurrentUser,
} from "~/modules/chat/client/services/webChatService";

describe("webChatService", () => {
  test("parses message payloads into the shared message shape", () => {
    const messages = [
      parseChatMessage({
        id: "00000000-0000-4000-8000-000000000001",
        type: "interactive",
        userType: "bot",
        text: "Pick an option",
        buttonReplyOptions: ["A", "B"],
        createdAt: "2025-01-02T03:04:05.000Z",
      }),
    ];

    expect(messages).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: "interactive",
        userType: "bot",
        text: "Pick an option",
        buttonReplyOptions: ["A", "B"],
        createdAt: "2025-01-02T03:04:05.000Z",
      },
    ]);
  });

  test("parses current user payloads into the shared user shape", () => {
    const user = parseCurrentUser({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Irwin",
      email: undefined,
      phoneNumber: "5511999999999",
    });

    expect(user).toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Irwin",
      email: undefined,
      phoneNumber: "5511999999999",
    });
  });

  test("maps nullable wire fields to undefined", () => {
    const message = parseChatMessage({
      id: "00000000-0000-4000-8000-000000000001",
      type: "text",
      userType: "user",
      createdAt: "2025-01-02T03:04:05.000Z",
    });

    expect(message).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      type: "text",
      userType: "user",
      createdAt: "2025-01-02T03:04:05.000Z",
    });
  });
});
