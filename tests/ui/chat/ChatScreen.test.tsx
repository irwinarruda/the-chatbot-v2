import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatScreen } from "~/modules/chat/client/screens/ChatScreen";

const virtualizerHarness = vi.hoisted(() => ({
  options: undefined as
    | {
        getItemKey(index: number): string;
      }
    | undefined,
  measure: vi.fn(),
  measureElement: vi.fn(),
  scrollToIndex: vi.fn(),
}));

const chatState = vi.hoisted(() => ({
  currentUser: { name: "Irwin" },
  chatMessages: [
    {
      id: "user-message",
      type: "text",
      userType: "user",
      text: "Hello",
      createdAt: "2026-07-31T12:00:00.000Z",
    },
  ],
  chatInput: "",
  chatResponseProgress: undefined as
    | {
        rounds: Array<{
          round: number;
          reasoning: Array<{ contentIndex: number; text: string }>;
          tools: [];
        }>;
      }
    | undefined,
  currentModel: {
    provider: "openai-codex",
    model: "gpt-5.6-sol",
  },
  availableModels: [
    { provider: "openai-codex", model: "gpt-5.6-sol" },
    { provider: "zai-coding-cn", model: "glm-5.2" },
  ],
  reasoningEffort: "high",
  supportedReasoningEfforts: ["off", "low", "medium", "high", "max"],
  chatError: undefined,
  isChatBootstrapping: false,
  isChatSubmitting: true,
  audioInputOptions: [],
  selectedAudioInputId: "",
  isRecording: false,
  recordingDuration: 0,
  canSendChatInput: false,
  canSelectAudioInput: false,
  setChatInput: vi.fn(),
  clearChatError: vi.fn(),
  bootstrapChat: vi.fn(() => Promise.resolve("ready")),
  refreshChat: vi.fn(),
  syncAudioInputs: vi.fn(),
  selectAudioInput: vi.fn(),
  sendChatInput: vi.fn(),
  setModel: vi.fn(),
  setReasoningEffort: vi.fn(),
  sendButtonReply: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn((options: { getItemKey(index: number): string }) => {
    virtualizerHarness.options = options;
    return {
      getTotalSize: () => 240,
      getVirtualItems: () => [
        {
          index: 0,
          key: "user-message",
          start: 0,
          size: 60,
          end: 60,
          lane: 0,
        },
        {
          index: 1,
          key: "assistant-progress",
          start: 60,
          size: 180,
          end: 240,
          lane: 0,
        },
      ],
      measure: virtualizerHarness.measure,
      measureElement: virtualizerHarness.measureElement,
      scrollToIndex: virtualizerHarness.scrollToIndex,
    };
  }),
}));

vi.mock("~/modules/chat/client/services/audioInputService", () => ({
  audioInputService: {
    subscribeToDeviceChanges: () => vi.fn(),
  },
}));

vi.mock("~/shared/client/components/terminal/TerminalWindow", () => ({
  TerminalWindow: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/shared/client/providers/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));

vi.mock("~/shared/client/stores", () => ({
  useApp: <Result,>(selector: (state: typeof chatState) => Result) =>
    selector(chatState),
}));

describe("ChatScreen", () => {
  beforeEach(() => {
    chatState.chatInput = "";
    chatState.chatResponseProgress = undefined;
    chatState.isChatSubmitting = true;
    chatState.setModel.mockClear();
    virtualizerHarness.options = undefined;
    virtualizerHarness.measure.mockClear();
    virtualizerHarness.measureElement.mockClear();
    virtualizerHarness.scrollToIndex.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  test("preserves measured message sizes while progress and composer state change", () => {
    const { rerender } = render(<ChatScreen />);

    chatState.chatResponseProgress = {
      rounds: [
        {
          round: 1,
          reasoning: [{ contentIndex: 0, text: "Checking transactions" }],
          tools: [],
        },
      ],
    };
    rerender(<ChatScreen />);

    chatState.chatInput = "x";
    rerender(<ChatScreen />);

    expect(virtualizerHarness.measure).not.toHaveBeenCalled();
    expect(virtualizerHarness.measureElement).toHaveBeenCalled();
    expect(virtualizerHarness.options?.getItemKey(0)).toBe("user-message");
    expect(virtualizerHarness.options?.getItemKey(1)).toBe(
      "assistant-progress",
    );
  });

  test("changes models from the accessible composer picker", () => {
    chatState.isChatSubmitting = false;
    render(<ChatScreen />);

    fireEvent.change(screen.getByLabelText("AI model"), {
      target: { value: "zai-coding-cn/glm-5.2" },
    });

    expect(chatState.setModel).toHaveBeenCalledWith({
      provider: "zai-coding-cn",
      model: "glm-5.2",
    });
  });
});
