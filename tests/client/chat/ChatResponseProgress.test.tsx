import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ChatResponseProgress } from "~/modules/chat/client/components/ChatResponseProgress";
import type { ChatResponseProgressDTO } from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";

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

describe("ChatResponseProgress", () => {
  test("shows full live reasoning and discloses tool details on demand", async () => {
    const user = userEvent.setup();
    const progress: ChatResponseProgressDTO = {
      rounds: [
        {
          round: 1,
          reasoning: [
            {
              contentIndex: 0,
              text: "### Inspecting todos\n\n**Read-only** pass",
            },
          ],
          tools: [
            {
              contentIndex: 1,
              callId: "call-1",
              name: "list_todos",
              arguments: { status: "Pending" },
            },
            {
              contentIndex: 2,
              callId: "call-2",
              name: "get_bank_accounts",
              arguments: {},
            },
          ],
        },
      ],
    };
    const { rerender } = render(
      <ChatResponseProgress
        progress={progress}
        respondingLabel="Thinking..."
        respondingElapsedLabel="Thinking for {seconds}s"
        labels={labels}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");
    expect(
      screen.getByRole("heading", { name: "Inspecting todos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toHaveProperty("tagName", "STRONG");
    expect(screen.queryByText("### Inspecting todos")).not.toBeInTheDocument();
    expect(screen.getAllByText("running")).toHaveLength(2);
    expect(screen.queryByText("input")).not.toBeInTheDocument();
    const firstTool = screen.getByRole("button", { name: /list_todos/ });
    const secondTool = screen.getByRole("button", {
      name: /get_bank_accounts/,
    });
    expect(
      firstTool.compareDocumentPosition(secondTool) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(firstTool);

    expect(screen.getByText("input")).toBeInTheDocument();
    expect(screen.getAllByText(/"status": "Pending"/)).toHaveLength(2);

    const completed: ChatResponseProgressDTO = {
      rounds: [
        {
          ...progress.rounds[0],
          tools: [
            {
              ...progress.rounds[0]?.tools[0],
              callId: "call-1",
              name: "list_todos",
              outcome: { status: "succeeded", data: { count: 2 } },
            },
            {
              ...progress.rounds[0]?.tools[1],
              callId: "call-2",
              name: "get_bank_accounts",
              outcome: { status: "succeeded", data: { count: 5 } },
            },
          ],
        },
      ],
    };
    rerender(
      <ChatResponseProgress
        progress={completed}
        respondingLabel="Thinking..."
        respondingElapsedLabel="Thinking for {seconds}s"
        labels={labels}
      />,
    );

    expect(screen.getAllByText("done")).toHaveLength(2);
    expect(screen.getByText("output")).toBeInTheDocument();
    expect(screen.getAllByText(/"count": 2/)).toHaveLength(2);
  });
});
