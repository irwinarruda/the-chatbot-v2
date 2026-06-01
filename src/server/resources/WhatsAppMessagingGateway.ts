import crypto from "crypto";
import type { WhatsAppConfig } from "~/infra/config";
import type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import { WhatsAppTextChunker } from "~/server/utils/WhatsAppTextChunker";
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";

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
            ...this.getRecipientPayload(dto.toAddress),
            messaging_product: "whatsapp",
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
          ...this.getRecipientPayload(dto.toAddress),
          messaging_product: "whatsapp",
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
      const root = data as Record<string, unknown>;
      const entry = (root?.entry as Record<string, unknown>[])?.[0];
      const change = (entry?.changes as Record<string, unknown>[])?.[0];
      const value = change?.value as Record<string, unknown> | undefined;
      const metadataPhoneNumberId = (
        value?.metadata as Record<string, unknown> | undefined
      )?.phone_number_id;
      if (metadataPhoneNumberId !== this.config.phoneNumberId) {
        return undefined;
      }
      const messages = value?.messages as Record<string, unknown>[] | undefined;
      if (!messages || messages.length === 0) return undefined;
      const message = messages[0];
      const contact = (value?.contacts as Record<string, unknown>[])?.[0];
      const bsuid =
        (message.from_user_id as string | undefined) ??
        (contact?.user_id as string | undefined) ??
        undefined;
      const waId = contact?.wa_id as string | undefined;
      const phoneNumber = waId
        ? PhoneNumberUtils.addDigitNine(waId)
        : undefined;
      const fromAddress = bsuid ?? phoneNumber;
      if (!fromAddress) return undefined;
      const channelMessageId = message.id as string;
      const channel = ChatChannel.WhatsApp;
      if (message.audio) {
        const audio = message.audio as Record<string, unknown>;
        return {
          fromAddress,
          whatsAppPhoneNumber: phoneNumber,
          channelMessageId,
          channel,
          mediaId: audio.id as string,
          mimeType: audio.mime_type as string,
        } as ReceiveAudioMessageDTO;
      }
      if (
        (message.interactive as Record<string, unknown> | undefined)
          ?.button_reply
      ) {
        const buttonReply = (
          (message.interactive as Record<string, unknown>)
            .button_reply as Record<string, unknown>
        ).title as string;
        return {
          fromAddress,
          whatsAppPhoneNumber: phoneNumber,
          channelMessageId,
          channel,
          buttonReply,
        } as ReceiveInteractiveButtonMessageDTO;
      }
      if (message.text) {
        const textBody = (message.text as Record<string, unknown>)
          .body as string;
        return {
          fromAddress,
          whatsAppPhoneNumber: phoneNumber,
          channelMessageId,
          channel,
          text: textBody,
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
    const mediaData = (await mediaUrlResponse.json()) as Record<
      string,
      unknown
    >;
    const mediaUrl = mediaData.url as string | undefined;
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

  private getRecipientPayload(toAddress: string) {
    if (BsuidUtils.isValid(toAddress)) {
      return {
        recipient_type: "individual",
        recipient: toAddress,
      };
    }
    return { to: toAddress };
  }
}
