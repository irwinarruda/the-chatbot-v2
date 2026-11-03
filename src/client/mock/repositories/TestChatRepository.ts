import { DemoNow, mockDb } from "~/client/mock/db";
import type { SendWebAudioDTO } from "~/client/modules/chat/app/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/client/modules/chat/app/dtos/SendWebMessageDTO";
import type { ChatRepository } from "~/client/modules/chat/app/repositories/ChatRepository";

export class TestChatRepository implements ChatRepository {
  async getChat() {
    return mockDb.chat;
  }

  async sendMessage(dto: SendWebMessageDTO) {
    const text = dto.text ?? dto.buttonReply ?? "";
    mockDb.chat.messages.push(
      {
        id: crypto.randomUUID(),
        clientMessageId: dto.clientMessageId,
        type: dto.buttonReply ? "interactive" : "text",
        userType: "user",
        text: dto.text,
        buttonReply: dto.buttonReply,
        createdAt: DemoNow,
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        userType: "bot",
        text: `This is demo mode, so nothing was sent. You said: *${text}*`,
        createdAt: DemoNow,
      },
    );
    return mockDb.chat;
  }

  async sendAudio(dto: SendWebAudioDTO) {
    mockDb.chat.messages.push({
      id: crypto.randomUUID(),
      clientMessageId: dto.clientMessageId,
      type: "text",
      userType: "bot",
      text: "Audio is not transcribed in demo mode.",
      createdAt: DemoNow,
    });
    return mockDb.chat;
  }
}
