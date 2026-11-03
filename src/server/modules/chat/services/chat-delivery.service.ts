import type { AssistantMessageOptions, Chat } from "~/domain/chat/chat";
import { ChatChannel } from "~/domain/chat/chat-channel";
import type { Message } from "~/domain/chat/message";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ValidationException } from "~/domain/shared/domain-errors";
import type {
  MessagingGateway,
  SendMessageRecipientDTO,
} from "~/server/modules/chat/gateways/messaging";
import type { WebMessagingGateway } from "~/server/modules/chat/gateways/web-messaging";
import type { WhatsAppMessagingGateway } from "~/server/modules/chat/gateways/whatsapp-messaging";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import {
  MessageLoader,
  MessageTemplate,
} from "~/server/modules/chat/utils/message-loader";

export class ChatDeliveryService {
  constructor(
    private chats: ChatRepository,
    private whatsAppMessagingGateway: WhatsAppMessagingGateway,
    private webMessagingGateway: WebMessagingGateway,
  ) {}

  async sendTextMessage(
    recipient: string | SendMessageRecipientDTO,
    text: string,
    chat?: Chat,
    options?: AssistantMessageOptions,
  ): Promise<void> {
    const dto = toRecipient(recipient);
    const target = await this.requireChat(dto, chat);
    const message = target.addAssistantTextMessage(text, options);
    await this.chats.createMessage(message);
    await this.gatewayFor(dto.channel).sendTextMessage({
      toAddress: dto.toAddress,
      text,
    });
  }

  async sendButtonReplyMessage(
    recipient: string | SendMessageRecipientDTO,
    text: string,
    options: string[],
    chat?: Chat,
    messageOptions?: AssistantMessageOptions,
  ): Promise<void> {
    const dto = toRecipient(recipient);
    const target = await this.requireChat(dto, chat);
    const message = target.addAssistantButtonMessage(
      text,
      options,
      messageOptions,
    );
    await this.chats.createMessage(message);
    await this.gatewayFor(dto.channel).sendInteractiveReplyButtonMessage({
      toAddress: dto.toAddress,
      text,
      buttons: options,
    });
  }

  async sendSignedInMessage(channelAddress: string): Promise<void> {
    await this.sendTextMessage(
      channelAddress,
      MessageLoader.getMessage(MessageTemplate.SignedIn),
    );
  }

  async sendPersisted(
    recipient: SendMessageRecipientDTO,
    text: string,
  ): Promise<void> {
    await this.gatewayFor(recipient.channel).sendTextMessage({
      toAddress: recipient.toAddress,
      text,
    });
  }

  async deliverGenerated(
    recipient: SendMessageRecipientDTO,
    messages: Message[],
  ): Promise<void> {
    const gateway = this.gatewayFor(recipient.channel);
    for (const message of messages) {
      if (message.content.type === MessageContentType.Button) {
        await gateway.sendInteractiveReplyButtonMessage({
          toAddress: recipient.toAddress,
          text: message.content.text,
          buttons: [...(message.content.options ?? [])],
        });
      } else if (message.content.type === MessageContentType.Text) {
        await gateway.sendTextMessage({
          toAddress: recipient.toAddress,
          text: message.content.text,
        });
      }
    }
  }

  gatewayFor(channel: ChatChannel): MessagingGateway {
    switch (channel) {
      case ChatChannel.WhatsApp:
        return this.whatsAppMessagingGateway;
      case ChatChannel.Web:
        return this.webMessagingGateway;
      default:
        throw new ValidationException("Unsupported chat channel");
    }
  }

  private async requireChat(
    recipient: SendMessageRecipientDTO,
    chat?: Chat,
  ): Promise<Chat> {
    const target =
      chat ??
      (await this.chats.findByChannelAddress(
        recipient.toAddress,
        recipient.channel,
      ));
    if (!target) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    return target;
  }
}

function toRecipient(
  recipient: string | SendMessageRecipientDTO,
): SendMessageRecipientDTO {
  if (typeof recipient === "string") {
    return { channel: ChatChannel.WhatsApp, toAddress: recipient };
  }
  return recipient;
}
