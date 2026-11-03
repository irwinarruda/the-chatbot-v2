import type { SendWebAudioDTO } from "~/client/modules/chat/app/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/client/modules/chat/app/dtos/SendWebMessageDTO";
import type {
  ChatResponseProgressEventDTO,
  WebChatDTO,
} from "~/contracts/http/chat/chat";

export type ChatProgressListener = (
  event: ChatResponseProgressEventDTO,
) => void;

export interface ChatRepository {
  getChat(): Promise<WebChatDTO>;
  sendMessage(
    dto: SendWebMessageDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO>;
  sendAudio(
    dto: SendWebAudioDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO>;
}
