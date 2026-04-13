import { randomUUID } from "crypto";
import { ChatType } from "~/entities/enums/ChatType";
import type {
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";

export class TestWhatsAppMessagingGateway implements IWhatsAppMessagingGateway {
  static phoneNumber = "5511984444444";
  static fixedIdProvider = randomUUID();

  async sendTextMessage(_dto: SendTextMessageDTO): Promise<void> {}

  async sendInteractiveReplyButtonMessage(
    _dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {}

  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined {
    const text = typeof data === "string" ? data : JSON.stringify(data);
    const receiveTextMessage: ReceiveTextMessageDTO = {
      from: TestWhatsAppMessagingGateway.phoneNumber,
      text: text,
      chatType: ChatType.WhatsApp,
      idProvider: text.includes("Second duplicate")
        ? TestWhatsAppMessagingGateway.fixedIdProvider
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
