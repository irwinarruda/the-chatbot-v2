import { describe, expect, test } from "vitest";
import { WebChatApi } from "~/client/utils/WebChatApi";

describe("webChatApi", () => {
  test("parses message payloads into the shared message shape", () => {
    const messages = WebChatApi.parseWebMessagesResponse({
      messages: [
        {
          id: "message-1",
          type: "interactive",
          user_type: "bot",
          text: "Pick an option",
          button_reply_options: ["A", "B"],
          created_at: "2025-01-02T03:04:05.000Z",
        },
      ],
    });

    expect(messages).toEqual([
      {
        id: "message-1",
        type: "interactive",
        userType: "bot",
        text: "Pick an option",
        buttonReplyOptions: ["A", "B"],
        createdAt: "2025-01-02T03:04:05.000Z",
      },
    ]);
  });

  test("parses current user payloads into the shared user shape", () => {
    const user = WebChatApi.parseCurrentUserResponse({
      id: "user-1",
      name: "Irwin",
      email: undefined,
      phone_number: "5511999999999",
    });

    expect(user).toEqual({
      id: "user-1",
      name: "Irwin",
      email: undefined,
      phoneNumber: "5511999999999",
    });
  });

  test("maps nullable wire fields to undefined", () => {
    const messages = WebChatApi.parseWebMessagesResponse({
      messages: [
        {
          id: "message-1",
          type: "text",
          user_type: "user",
          created_at: "2025-01-02T03:04:05.000Z",
        },
      ],
    });

    expect(messages).toEqual([
      {
        id: "message-1",
        type: "text",
        userType: "user",
        text: undefined,
        buttonReply: undefined,
        buttonReplyOptions: undefined,
        mediaUrl: undefined,
        mimeType: undefined,
        transcript: undefined,
        createdAt: "2025-01-02T03:04:05.000Z",
      },
    ]);
  });
});
