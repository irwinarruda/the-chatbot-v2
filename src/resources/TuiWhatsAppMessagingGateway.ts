import { NotFoundException } from "@infra/exceptions";
import type {
  IWhatsAppMessagingGateway,
  ReceiveMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IWhatsAppMessagingGateway";
import { WhatsAppTextChunker } from "~/utils/WhatsAppTextChunker";

export interface TuiOutgoingMessage {
  Type: "text" | "button";
  Text: string;
  To: string;
  Buttons?: string[];
}

export class TuiWhatsAppMessagingGateway implements IWhatsAppMessagingGateway {
  private mediaById = new Map<string, Buffer>();
  private waiters: Array<(msg: TuiOutgoingMessage) => void> = [];
  private queue: TuiOutgoingMessage[] = [];

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    const chunks = WhatsAppTextChunker.chunk(dto.text);
    for (const chunk of chunks) {
      this.enqueue({ Type: "text", Text: chunk, To: dto.to });
    }
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue({
      Type: "button",
      Text: dto.text,
      To: dto.to,
      Buttons: [...dto.buttons],
    });
  }

  receiveMessage(_data: unknown): ReceiveMessageDTO | undefined {
    return undefined;
  }

  validateWebhook(_hubMode: string, _hubVerifyToken: string): boolean {
    return true;
  }

  validateSignature(_signature: string, _rawBody: string): boolean {
    return true;
  }

  async saveMediaAsync(buffer: Buffer): Promise<string> {
    const mediaId = crypto.randomUUID();
    this.mediaById.set(mediaId, buffer);
    return mediaId;
  }

  async downloadMediaAsync(mediaId: string): Promise<Buffer> {
    const mediaBytes = this.mediaById.get(mediaId);
    if (!mediaBytes) {
      throw new NotFoundException(
        "Audio file was not found in the TUI media store",
      );
    }
    return mediaBytes;
  }

  async *getOutgoingMessages(
    signal: AbortSignal,
  ): AsyncGenerator<TuiOutgoingMessage> {
    while (!signal.aborted) {
      if (this.queue.length > 0) {
        const msg = this.queue.shift();
        if (msg) yield msg;
        continue;
      }
      const msg = await new Promise<TuiOutgoingMessage>((resolve, reject) => {
        const onAbort = () => {
          const idx = this.waiters.indexOf(resolve);
          if (idx >= 0) this.waiters.splice(idx, 1);
          reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        this.waiters.push((m) => {
          signal.removeEventListener("abort", onAbort);
          resolve(m);
        });
      });
      yield msg;
    }
  }

  private enqueue(msg: TuiOutgoingMessage): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(msg);
    } else {
      this.queue.push(msg);
    }
  }
}
