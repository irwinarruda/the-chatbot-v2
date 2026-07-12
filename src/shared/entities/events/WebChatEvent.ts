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
