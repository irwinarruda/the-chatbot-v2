import { resolve } from "path";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/domain/enums/MessageRole";
import { PiAiChatGateway } from "~/modules/chat/server/PiAiChatGateway";
import { loadConfig } from "~/shared/server/Config";
import { loadModeEnv, resolveMode } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");

loadModeEnv(mode, root);

const config = loadConfig();
const gateway = new PiAiChatGateway(config.ai);
const response = await gateway.complete({
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
