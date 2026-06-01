import type { Message } from "~/shared/entities/Message";
import type { User } from "~/shared/entities/User";

export type SharedChatMessage = ReturnType<Message["toJSON"]>;

export type SharedCurrentUser = ReturnType<User["toJSON"]>;

export type WebChatEvent =
  | {
      type: "text";
      data: {
        toAddress?: string;
        text?: string;
      };
    }
  | {
      type: "interactive_button";
      data: {
        toAddress?: string;
        text?: string;
        buttons?: string[];
      };
    }
  | {
      type: "audio";
      data: {
        mediaUrl?: string;
        mimeType?: string;
        transcript?: string;
      };
    }
  | {
      type: "error";
      data: {
        text?: string;
      };
    };
