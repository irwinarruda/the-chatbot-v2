import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { Message } from "~/modules/chat/entities/Message";
import {
  createAiContextCompactionPolicy,
  selectCompactableTurns,
} from "~/modules/chat/utils/AiContextCompactionPolicy";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("AiContextCompactionPolicy", () => {
  test("derives bounded trigger and target budgets from the model window", () => {
    const policy = createAiContextCompactionPolicy(272_000, 128_000);

    expect(policy).toEqual({
      hardInputTokens: 127_616,
      triggerTokens: 57_427,
      targetTokens: 38_284,
      protectedRecentTurns: 6,
    });
  });

  test("scales down for models with smaller context windows", () => {
    const policy = createAiContextCompactionPolicy(32_000, 8_192);

    expect(policy).toEqual({
      hardInputTokens: 20_608,
      triggerTokens: 9_273,
      targetTokens: 6_182,
      protectedRecentTurns: 6,
    });
  });

  test("rejects models without usable input context", () => {
    expect(() => createAiContextCompactionPolicy(4_096, 4_096)).toThrow(
      ValidationException,
    );
  });

  test("stops compaction at the first incomplete turn", () => {
    const first = createCompleteTurn("first");
    const second = createCompleteTurn("second");
    const incomplete = createUserTurn("incomplete");
    const later = createCompleteTurn("later");

    expect(
      selectCompactableTurns([first, second, incomplete, later], 1),
    ).toEqual([first]);
  });
});

function createCompleteTurn(text: string): Message[] {
  const user = createUserTurn(text)[0];
  return [
    user,
    new Message({
      idChat: "chat-id",
      turnId: user.turnId,
      role: MessageRole.Assistant,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Text, text: `${text} reply` },
    }),
  ];
}

function createUserTurn(text: string): Message[] {
  return [
    new Message({
      idChat: "chat-id",
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Text, text },
    }),
  ];
}
