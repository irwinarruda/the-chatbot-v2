import { resolve } from "path";
import { loadConfig } from "~/infra/config";
import { PiAiChatGateway } from "~/server/resources/PiAiChatGateway";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { MessageRole } from "~/shared/entities/enums/MessageRole";
import { ToolResultStatus } from "~/shared/entities/enums/ToolResultStatus";
import { loadModeEnv, resolveMode } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");

loadModeEnv(mode, root);

const config = loadConfig();
const gateway = new PiAiChatGateway(config.ai);
const response = await gateway.runAgent({
  channelAddress: "pi-smoke-test",
  messages: [
    {
      role: MessageRole.User,
      content: {
        type: MessageContentType.Text,
        text: "Reply with exactly: pi smoke ok",
      },
    },
  ],
  tools: [],
  maxToolRounds: 1,
  onToolCalls: async () => {},
  executeTool: async (call) => ({
    type: MessageContentType.ToolResult,
    callId: call.callId,
    outcome: {
      status: ToolResultStatus.Failed,
      code: "UnexpectedToolCall",
      message: "The smoke test does not expose tools.",
    },
  }),
});

console.log(
  JSON.stringify(
    {
      provider: config.ai.provider,
      model: config.ai.model,
      finishReason: response.finishReason,
      content: response.content,
      usage: response.usage,
    },
    undefined,
    2,
  ),
);
