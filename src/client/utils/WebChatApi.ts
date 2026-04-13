import type {
  SharedChatMessage,
  SharedCurrentUser,
} from "~/shared/types/web-chat";

type WireChatMessage = {
  id: string;
  type: SharedChatMessage["type"];
  user_type: SharedChatMessage["userType"];
  text?: string;
  button_reply?: string;
  button_reply_options?: string[];
  media_url?: string;
  mime_type?: string;
  transcript?: string;
  created_at: string;
};

type WireCurrentUser = {
  id: string;
  name: string;
  email?: string;
  phone_number: string;
};

export class WebChatApi {
  static parseWebMessagesResponse(data: {
    messages?: WireChatMessage[];
  }): SharedChatMessage[] {
    return (data.messages ?? []).map((message) => ({
      id: message.id,
      type: message.type,
      userType: message.user_type,
      text: message.text,
      buttonReply: message.button_reply,
      buttonReplyOptions: message.button_reply_options,
      mediaUrl: message.media_url,
      mimeType: message.mime_type,
      transcript: message.transcript,
      createdAt: message.created_at,
    }));
  }

  static parseCurrentUserResponse(data: WireCurrentUser): SharedCurrentUser {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phoneNumber: data.phone_number,
    };
  }
}
