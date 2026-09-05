import crypto from "crypto";
import { z } from "zod";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import type {
  ReceiveMessageDTO,
  ReceiveMessageMetadataDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type { WhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway";
import { WhatsAppTextChunker } from "~/modules/chat/gateway/WhatsAppMessagingGateway/WhatsAppTextChunker";
import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";
import type { WhatsAppConfig } from "~/shared/config/Config";

const incomingMessageSchema = z.object({
  id: z.string().min(1),
  from_user_id: z.string().optional(),
  audio: z
    .object({
      id: z.string().min(1),
      mime_type: z.string().min(1),
    })
    .optional(),
  interactive: z
    .object({
      button_reply: z.object({ title: z.string() }).optional(),
    })
    .optional(),
  text: z.object({ body: z.string() }).optional(),
});

const webhookValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }),
  contacts: z
    .array(
      z.object({
        user_id: z.string().optional(),
        wa_id: z.string().optional(),
      }),
    )
    .optional(),
  messages: z.array(incomingMessageSchema).optional(),
});

const webhookSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(z.object({ value: webhookValueSchema })),
    }),
  ),
});

const mediaMetadataSchema = z.object({ url: z.url() });

export class MetaWhatsAppMessagingGateway implements WhatsAppMessagingGateway {
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
    if (!/^[a-f0-9]{64}$/.test(hash)) return false;
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
    const parsed = webhookSchema.safeParse(data);
    if (!parsed.success) return undefined;
    const value = parsed.data.entry[0]?.changes[0]?.value;
    if (value?.metadata.phone_number_id !== this.config.phoneNumberId) {
      return undefined;
    }
    const message = value.messages?.[0];
    if (!message) return undefined;
    const contact = value.contacts?.[0];
    const bsuid = message.from_user_id ?? contact?.user_id;
    let phoneNumber: string | undefined;
    if (contact?.wa_id) {
      phoneNumber = PhoneNumberUtils.addDigitNine(contact.wa_id);
    }
    const fromAddress = phoneNumber ?? bsuid;
    if (!fromAddress) return undefined;
    const metadata: ReceiveMessageMetadataDTO = {
      fromAddress,
      whatsAppBsuid: bsuid,
      channelMessageId: message.id,
      channel: ChatChannel.WhatsApp,
    };
    if (message.audio) {
      return {
        ...metadata,
        mediaId: message.audio.id,
        mimeType: message.audio.mime_type,
      };
    }
    if (message.interactive?.button_reply) {
      return {
        ...metadata,
        buttonReply: message.interactive.button_reply.title,
      };
    }
    if (message.text) {
      return { ...metadata, text: message.text.body };
    }
    return undefined;
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
    const mediaData = mediaMetadataSchema.safeParse(
      await mediaUrlResponse.json(),
    );
    if (!mediaData.success) {
      throw new Error(
        `WhatsApp media metadata response missing or invalid 'url' for mediaId ${mediaId}`,
      );
    }
    const response = await fetch(mediaData.data.url, {
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
    if (BsuidUtils.containsLetter(toAddress)) {
      return {
        recipient_type: "individual",
        recipient: toAddress,
      };
    }
    return { to: toAddress };
  }
}
