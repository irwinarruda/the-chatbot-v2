import type { Message } from "~/shared/entities/Message";

export type ChatMessageDTO = ReturnType<Message["toJSON"]>;
