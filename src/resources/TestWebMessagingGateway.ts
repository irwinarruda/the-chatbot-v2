import { ChatType } from "~/entities/enums/ChatType";
import type {
  ReceiveMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
} from "~/resources/IWebMessagingGateway";

export class TestWebMessagingGateway implements IWebMessagingGateway {
  private events: WebChatEvent[] = [];
  private mediaById = new Map<string, Buffer>();

  async receiveWebMessage(
    phoneNumber: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const data = body as {
      text?: string;
      buttonReply?: string;
      audioBuffer?: Buffer;
      mimeType?: string;
    };
    if (data.audioBuffer && data.mimeType) {
      const mediaId = crypto.randomUUID();
      this.mediaById.set(mediaId, data.audioBuffer);
      return {
        from: phoneNumber,
        mediaId,
        mimeType: data.mimeType,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      } as ReceiveMessageDTO;
    }
    if (data.buttonReply) {
      return {
        from: phoneNumber,
        buttonReply: data.buttonReply,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      } as ReceiveMessageDTO;
    }
    return {
      from: phoneNumber,
      text: data.text ?? "",
      chatType: ChatType.Web,
      idProvider: crypto.randomUUID(),
    } as ReceiveMessageDTO;
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.to, { type: "text", data: dto });
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue(dto.to, { type: "interactive_button", data: dto });
  }

  async downloadMediaAsync(_mediaId: string): Promise<Buffer> {
    return Buffer.from("test-audio-content");
  }

  enqueue(_phoneNumber: string, event: WebChatEvent): void {
    this.events.push(event);
  }

  async *subscribe(
    _phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent> {
    while (!signal.aborted) {
      if (this.events.length > 0) {
        const event = this.events.shift();
        if (event) yield event;
        continue;
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 100);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }
  }

  getEvents(): WebChatEvent[] {
    return [...this.events];
  }
}
