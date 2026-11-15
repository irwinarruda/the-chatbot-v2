import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import { apiChatRepository } from "~/client/modules/chat/app/repositories/ApiChatRepository";
import {
  type ChatService,
  createChatService,
} from "~/client/modules/chat/app/services/ChatService";
import type { SessionService } from "~/client/modules/identity/app/services/SessionService";
import { container } from "~/client/shared/container";
import { toChatMessagesResponse } from "~/contracts/http/chat/chat-mapper";
import { ChatChannel } from "~/domain/chat/chat-channel";
import { MessageLocale } from "~/domain/chat/message-locale";
import { MessageRole } from "~/domain/chat/message-role";
import { streamWebChatResponse } from "~/server/modules/chat/controllers/stream-web-chat-response.controller";
import { createDeferred } from "~/tests/support/create-deferred";
import { orquestrator } from "~/tests/support/orchestrator";

type TestChatState = ChatService &
  Pick<SessionService, "currentUser" | "bootstrapSession">;

interface WebChatServer {
  server: Server;
  postCount: number;
  shouldRefusePosts: boolean;
  postSocket?: Socket;
}

async function serveWebChat(webAddress: string): Promise<WebChatServer> {
  const messaging = orquestrator.messagingService;
  const web: WebChatServer = {
    postCount: 0,
    shouldRefusePosts: false,
    server: createServer(async (request, response) => {
      response.on("error", () => {});
      if (request.method === "GET") {
        const chat = await messaging.getChatByChannelAddress(
          webAddress,
          ChatChannel.Web,
        );
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify(
            toChatMessagesResponse(
              chat,
              await messaging.getModelConfiguration(chat?.idUser),
            ),
          ),
        );
        return;
      }
      web.postCount += 1;
      if (web.shouldRefusePosts) {
        request.socket.destroy();
        return;
      }
      web.postSocket = request.socket;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      const stream = streamWebChatResponse(
        messaging,
        webAddress,
        JSON.parse(Buffer.concat(chunks).toString()),
        MessageLocale.PtBr,
      );
      response.writeHead(200, Object.fromEntries(stream.headers));
      response.flushHeaders();
      if (!stream.body) return;
      for await (const chunk of stream.body) response.write(chunk);
      response.end();
    }),
  };
  await new Promise<void>((resolve) => web.server.listen(0, resolve));
  const { port } = web.server.address() as AddressInfo;
  const request = globalThis.fetch;
  vi.stubGlobal("fetch", (url: string, options?: RequestInit) =>
    request(new URL(url, `http://127.0.0.1:${port}`), options),
  );
  return web;
}

function createChatStore() {
  container.register("ChatRepository", apiChatRepository);
  return create<TestChatState>()(
    computed((...args) => ({
      ...createChatService(...args),
      currentUser: undefined,
      bootstrapSession: async () => "ok" as const,
    })),
  );
}

async function createWebUser() {
  await orquestrator.clearDatabase();
  const user = await orquestrator.createUser({ phoneNumber: "5511912345678" });
  return user.email ?? "";
}

async function readSavedMessages(webAddress: string) {
  const chat = await orquestrator.messagingService.getChatByChannelAddress(
    webAddress,
    ChatChannel.Web,
  );
  return chat?.getChannelMessages() ?? [];
}

describe("web chat over a dropped connection", () => {
  let web: WebChatServer | undefined;

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    web?.server.closeAllConnections();
    await new Promise((resolve) => web?.server.close(resolve));
  });

  test("a connection lost mid-turn still ends with the reply and one saved turn", async () => {
    const webAddress = await createWebUser();
    web = await serveWebChat(webAddress);
    const modelStarted = createDeferred<void>();
    const modelReleased = createDeferred<void>();
    const complete = orquestrator.aiGateway.complete.bind(
      orquestrator.aiGateway,
    );
    const completeSpy = vi
      .spyOn(orquestrator.aiGateway, "complete")
      .mockImplementation(async (...args) => {
        modelStarted.resolve();
        await modelReleased.promise;
        return complete(...args);
      });
    const store = createChatStore();
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await modelStarted.promise;
    web.postSocket?.destroy();
    modelReleased.resolve();
    await sending;

    expect(store.getState().chatError).toBeUndefined();
    expect(store.getState().chatMessages.map((m) => m.text)).toEqual([
      "Hello",
      "Response to: Hello",
    ]);
    expect(web.postCount).toBe(1);
    expect(completeSpy).toHaveBeenCalledTimes(1);
    const saved = await readSavedMessages(webAddress);
    expect(saved.map((m) => m.role)).toEqual([
      MessageRole.User,
      MessageRole.Assistant,
    ]);
  });

  test("a message that never reached the server is sent again and answered once", async () => {
    const webAddress = await createWebUser();
    web = await serveWebChat(webAddress);
    web.shouldRefusePosts = true;
    const completeSpy = vi.spyOn(orquestrator.aiGateway, "complete");
    const store = createChatStore();
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.waitFor(() => expect(web?.postCount).toBe(1));
    web.shouldRefusePosts = false;
    await sending;

    expect(store.getState().chatError).toBeUndefined();
    expect(store.getState().chatMessages.map((m) => m.text)).toEqual([
      "Hello",
      "Response to: Hello",
    ]);
    expect(web.postCount).toBe(2);
    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(await readSavedMessages(webAddress)).toHaveLength(2);
  });
});
