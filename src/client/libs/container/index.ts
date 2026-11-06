import type { ArtifactRepository } from "~/client/modules/artifacts/app/repositories/ArtifactRepository";
import type { CashFlowRepository } from "~/client/modules/cash-flow/app/repositories/CashFlowRepository";
import type { MonthlyExpenseRepository } from "~/client/modules/cash-flow/app/repositories/MonthlyExpenseRepository";
import type { AudioInputGateway } from "~/client/modules/chat/app/gateways/AudioInputGateway";
import type { AudioRecordingGateway } from "~/client/modules/chat/app/gateways/AudioRecordingGateway";
import type { ChatRepository } from "~/client/modules/chat/app/repositories/ChatRepository";
import type { SessionRepository } from "~/client/modules/identity/app/repositories/SessionRepository";
import type { NoteRepository } from "~/client/modules/notes/app/repositories/NoteRepository";
import type { TodoRepository } from "~/client/modules/todos/app/repositories/TodoRepository";
import type { MonetaryPrivacyGateway } from "~/client/shared/app/gateways/MonetaryPrivacyGateway";
import type { PrefsGateway } from "~/client/shared/app/gateways/PrefsGateway";

export interface InjectableItems {
  SessionRepository: SessionRepository;
  PrefsGateway: PrefsGateway;
  MonetaryPrivacyGateway: MonetaryPrivacyGateway;
  CashFlowRepository: CashFlowRepository;
  MonthlyExpenseRepository: MonthlyExpenseRepository;
  ChatRepository: ChatRepository;
  AudioInputGateway: AudioInputGateway;
  AudioRecordingGateway: AudioRecordingGateway;
  NoteRepository: NoteRepository;
  TodoRepository: TodoRepository;
  ArtifactRepository: ArtifactRepository;
}

export function createContainer() {
  const items = new Map<keyof InjectableItems, unknown>();
  return {
    register<K extends keyof InjectableItems>(
      key: K,
      value: InjectableItems[K],
    ) {
      items.set(key, value);
    },
    get<K extends keyof InjectableItems>(key: K) {
      const item = items.get(key);
      if (item === undefined) {
        throw new Error(`No registration found for "${String(key)}".`);
      }
      return item as InjectableItems[K];
    },
  };
}
