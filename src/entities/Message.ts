import { v4 as uuidv4 } from "uuid";

export const MessageType = {
  Text: "text",
  ButtonReply: "interactive",
  Audio: "audio",
} as const;
export type MessageType = ValueOf<typeof MessageType>;

export const MessageUserType = {
  User: "user",
  Bot: "bot",
} as const;
export type MessageUserType = ValueOf<typeof MessageUserType>;

export interface MessageConfig {
  idChat: string;
  type: MessageType;
  userType: MessageUserType;
  idProvider?: string;
  text?: string;
  buttonReply?: string;
  buttonReplyOptions?: string[];
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
}

export class Message {
  id: string;
  idChat: string;
  idProvider: string | undefined;
  type: MessageType;
  userType: MessageUserType;
  text: string | undefined;
  buttonReply: string | undefined;
  buttonReplyOptions: string[] | undefined;
  mediaId: string | undefined;
  mediaUrl: string | undefined;
  mimeType: string | undefined;
  transcript: string | undefined;
  createdAt: Date;
  updatedAt: Date;

  constructor(config?: MessageConfig) {
    this.id = uuidv4();
    this.idChat = config?.idChat ?? "";
    this.idProvider = config?.idProvider ?? undefined;
    this.type = config?.type ?? ("text" as MessageType);
    this.userType = config?.userType ?? ("user" as MessageUserType);
    this.text = config?.text ?? undefined;
    this.buttonReply = config?.buttonReply ?? undefined;
    this.buttonReplyOptions = config?.buttonReplyOptions ?? undefined;
    this.mediaId = config?.mediaId ?? undefined;
    this.mediaUrl = config?.mediaUrl ?? undefined;
    this.mimeType = config?.mimeType ?? undefined;
    this.transcript = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addAudioTranscriptAndUrl(transcript: string, url: string): void {
    this.transcript = transcript;
    this.mediaUrl = url;
    this.updatedAt = new Date();
  }
}
