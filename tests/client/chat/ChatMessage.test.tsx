import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ChatMessage } from "~/modules/chat/client/components/ChatMessage";
import type { ChatMessageDTO } from "~/modules/chat/entities/dtos/ChatDTO";

const labels = {
  traceShow: "Show trace",
  traceHide: "Hide trace",
  traceReasoning: "reasoning",
  traceReasonings: "reasoning steps",
  traceTool: "tool",
  traceTools: "tools",
  traceTokens: "tokens",
  traceRedacted: "Redacted by provider",
  toolRunning: "running",
  toolSucceeded: "done",
  toolFailed: "failed",
  toolUnknown: "unknown",
  toolInput: "input",
  toolOutput: "output",
};

describe("ChatMessage", () => {
  test("keeps generation traces collapsed and reveals safe details on demand", async () => {
    const user = userEvent.setup();
    const message: ChatMessageDTO = {
      id: crypto.randomUUID(),
      type: "text",
      userType: "bot",
      text: "Done.",
      createdAt: "2026-07-30T12:00:00.000Z",
      trace: [
        {
          id: crypto.randomUUID(),
          provider: "zai",
          model: "glm-4.5",
          reasoningEffort: "high",
          finishReason: "toolUse",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          items: [
            {
              type: "reasoning",
              text: "provider secret",
              redacted: true,
            },
            {
              type: "reasoning",
              text: "## Complete plan\n\n1. **Linguistic angle**: Both phrases are recursive.\n2. **Philosophical angle**: Cost and value differ.",
            },
            {
              type: "toolCall",
              callId: "call-1",
              name: "list_todos",
              arguments: { status: "Pending" },
            },
            {
              type: "toolResult",
              callId: "call-1",
              outcome: {
                status: "succeeded",
                data: { count: 2 },
              },
            },
          ],
        },
      ],
    };

    render(
      <ChatMessage
        message={message}
        theme="dark"
        locale="en"
        isSending={false}
        youLabel="You"
        botLabel="Assistant"
        showMoreLabel="Show more"
        showLessLabel="Show less"
        activityLabels={labels}
        onButtonReply={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Show trace/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Redacted by provider")).not.toBeInTheDocument();
    const answer = screen.getByText("Done.");
    expect(
      toggle.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(toggle);

    expect(screen.getByRole("button", { name: /Hide trace/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Redacted by provider")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Complete plan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Linguistic angle")).toHaveProperty(
      "tagName",
      "STRONG",
    );
    expect(screen.getByText(/Both phrases are recursive/)).toHaveProperty(
      "tagName",
      "LI",
    );
    expect(
      screen.queryByText(/\*\*Linguistic angle\*\*/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("provider secret")).not.toBeInTheDocument();
    expect(screen.queryByText("input")).not.toBeInTheDocument();
    expect(screen.queryByText("output")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /list_todos/ }));

    expect(screen.getByText("input")).toBeInTheDocument();
    expect(screen.getByText("output")).toBeInTheDocument();
    expect(screen.getAllByText(/"count": 2/)).toHaveLength(2);
  });
});
