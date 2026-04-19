import { v4 as uuidv4 } from "uuid";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";

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
  idProvider?: string;
  type: MessageType;
  userType: MessageUserType;
  text?: string;
  buttonReply?: string;
  buttonReplyOptions?: string[];
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  transcript?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(config?: MessageConfig) {
    this.id = uuidv4();
    this.idChat = config?.idChat ?? "";
    this.idProvider = config?.idProvider ?? undefined;
    this.type = config?.type ?? MessageType.Text;
    this.userType = config?.userType ?? MessageUserType.User;
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

  toJSON() {
    return {
      id: this.id,
      type: this.type.toLowerCase(),
      userType: this.userType.toLowerCase(),
      text: this.text,
      buttonReply: this.buttonReply,
      buttonReplyOptions: this.buttonReplyOptions,
      mediaUrl: this.mediaUrl,
      mimeType: this.mimeType,
      transcript: this.transcript,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
