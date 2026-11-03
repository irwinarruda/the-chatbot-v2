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

export interface AppAdapters {
  session: SessionRepository;
  prefs: PrefsGateway;
  privacy: MonetaryPrivacyGateway;
  cashFlow: CashFlowRepository;
  monthlyExpenses: MonthlyExpenseRepository;
  chat: ChatRepository;
  audioInputs: AudioInputGateway;
  audioRecording: AudioRecordingGateway;
  notes: NoteRepository;
  todos: TodoRepository;
  artifacts: ArtifactRepository;
}
