import type { WhatsAppConfig } from "@infra/config";
import crypto from "crypto";
import { ChatType } from "~/entities/enums/ChatType";
import { addDigitNine } from "~/entities/PhoneNumberUtils";
import type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";
import { WhatsAppTextChunker } from "~/utils/WhatsAppTextChunker";

export class WhatsAppMessagingGateway implements IWhatsAppMessagingGateway {
  private readonly baseUrl = "https://graph.facebook.com";

  constructor(private config: WhatsAppConfig) {}

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    const chunks = WhatsAppTextChunker.chunk(dto.text);
    for (const chunk of chunks) {
      const response = await fetch(
        `${this.baseUrl}/${this.config.version}/${this.config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: dto.to,
            type: "text",
            text: { body: chunk },
          }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[WhatsApp] sendTextMessage failed (${response.status}): ${body}`,
        );
        throw new Error(
          `WhatsApp sendTextMessage failed with status ${response.status}`,
        );
      }
    }
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${this.config.version}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: dto.to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: dto.text },
            action: {
              buttons: dto.buttons.map((b, i) => ({
                type: "reply",
                reply: { id: `btn_${i + 1}`, title: b },
              })),
            },
          },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[WhatsApp] sendInteractiveReplyButtonMessage failed (${response.status}): ${body}`,
      );
      throw new Error(
        `WhatsApp sendInteractiveReplyButtonMessage failed with status ${response.status}`,
      );
    }
  }

  validateSignature(signature: string, rawBody: string): boolean {
    const appSecret = this.config.appSecret;
    if (!appSecret) return false;
    if (!signature) return false;
    const signatureParts = signature.split("=");
    if (signatureParts.length !== 2 || signatureParts[0] !== "sha256")
      return false;
    const hash = signatureParts[1];
    const computedHash = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  }

  validateWebhook(hubMode: string, hubVerifyToken: string): boolean {
    return (
      hubMode === "subscribe" &&
      hubVerifyToken === this.config.webhookVerifyToken
    );
  }

  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined {
    try {
      const root = data as any;
      const entry = root?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (phoneNumberId !== this.config.phoneNumberId) return undefined;
      const messages = value?.messages;
      if (!messages || messages.length === 0) return undefined;
      const message = messages[0];
      const contact = value?.contacts?.[0];
      const from = addDigitNine(contact?.wa_id ?? "");
      const idProvider = message.id;
      const chatType = ChatType.WhatsApp;
      if (message.audio) {
        return {
          from,
          idProvider,
          chatType,
          mediaId: message.audio.id,
          mimeType: message.audio.mime_type,
        } as ReceiveAudioMessageDTO;
      }
      if (message.interactive?.button_reply) {
        return {
          from,
          idProvider,
          chatType,
          buttonReply: message.interactive.button_reply.title,
        } as ReceiveInteractiveButtonMessageDTO;
      }
      if (message.text) {
        return {
          from,
          idProvider,
          chatType,
          text: message.text.body,
        } as ReceiveTextMessageDTO;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  async downloadMediaAsync(mediaId: string): Promise<Buffer> {
    const mediaUrlResponse = await fetch(
      `${this.baseUrl}/${this.config.version}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      },
    );
    if (!mediaUrlResponse.ok) {
      const body = await mediaUrlResponse.text();
      console.error(
        `[WhatsApp] downloadMediaAsync metadata failed (${mediaUrlResponse.status}): ${body}`,
      );
      throw new Error(
        `WhatsApp media metadata request failed with status ${mediaUrlResponse.status}`,
      );
    }
    const mediaData = (await mediaUrlResponse.json()) as any;
    const mediaUrl = mediaData.url;
    if (!mediaUrl) {
      throw new Error(
        `WhatsApp media metadata response missing 'url' for mediaId ${mediaId}`,
      );
    }
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });
    if (!response.ok) {
      console.error(
        `[WhatsApp] downloadMediaAsync download failed (${response.status})`,
      );
      throw new Error(
        `WhatsApp media download failed with status ${response.status}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
