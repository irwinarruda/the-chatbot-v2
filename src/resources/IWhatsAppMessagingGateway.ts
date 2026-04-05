export interface SendTextMessageDTO {
  to: string;
  text: string;
}

export interface SendInteractiveButtonMessageDTO {
  to: string;
  text: string;
  buttons: string[];
}

export interface ReceiveMessageDTO {
  from: string;
  idProvider: string;
}

export interface ReceiveTextMessageDTO extends ReceiveMessageDTO {
  text: string;
}

export interface ReceiveInteractiveButtonMessageDTO extends ReceiveMessageDTO {
  buttonReply: string;
}

export interface ReceiveAudioMessageDTO extends ReceiveMessageDTO {
  mediaId: string;
  mimeType: string;
}

export interface IWhatsAppMessagingGateway {
  sendTextMessage(dto: SendTextMessageDTO): Promise<void>;
  sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void>;
  receiveMessage(data: unknown): ReceiveMessageDTO | undefined;
  downloadMediaAsync(mediaId: string): Promise<Buffer>;
  validateSignature(signature: string, rawBody: string): boolean;
  validateWebhook(hubMode: string, hubVerifyToken: string): boolean;
}
