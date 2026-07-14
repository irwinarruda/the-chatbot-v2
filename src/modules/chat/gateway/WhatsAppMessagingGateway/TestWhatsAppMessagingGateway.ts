import { randomUUID } from "crypto";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import type {
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type { WhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway";

export class TestWhatsAppMessagingGateway implements WhatsAppMessagingGateway {
  static phoneNumber = "5511984444444";
  static bsuid = "BR.13491208655302741918";
  static fixedChannelMessageId = randomUUID();

  async sendTextMessage(): Promise<void> {}

  async sendInteractiveReplyButtonMessage(): Promise<void> {}

  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined {
    if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      if (payload.dualIdWebhook) {
        return {
          fromAddress: TestWhatsAppMessagingGateway.phoneNumber,
          whatsAppBsuid: TestWhatsAppMessagingGateway.bsuid,
          text: "dual id message",
          channel: ChatChannel.WhatsApp,
          channelMessageId: randomUUID(),
        } as ReceiveTextMessageDTO;
      }
      if (payload.bsuidOnlyWebhook) {
        return {
          fromAddress: TestWhatsAppMessagingGateway.bsuid,
          text: "bsuid only message",
          channel: ChatChannel.WhatsApp,
          channelMessageId: randomUUID(),
        } as ReceiveTextMessageDTO;
      }
    }
    const text = typeof data === "string" ? data : JSON.stringify(data);
    const receiveTextMessage: ReceiveTextMessageDTO = {
      fromAddress: TestWhatsAppMessagingGateway.phoneNumber,
      text: text,
      channel: ChatChannel.WhatsApp,
      channelMessageId: text.includes("Second duplicate")
        ? TestWhatsAppMessagingGateway.fixedChannelMessageId
        : randomUUID(),
    };
    return receiveTextMessage;
  }

  validateWebhook(_hubMode: string, _hubVerifyToken: string): boolean {
    return true;
  }

  validateSignature(_signature: string, _rawBody: string): boolean {
    return true;
  }

  async downloadMediaAsync(_mediaId: string): Promise<Buffer> {
    return Buffer.alloc(0);
  }
}
