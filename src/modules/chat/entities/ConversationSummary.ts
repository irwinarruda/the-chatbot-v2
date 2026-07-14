export interface ConversationSummaryConfig {
  userProfile: string[];
  durableFacts: string[];
  compactedThroughSequence: number;
}

export class ConversationSummary {
  userProfile: string[];
  durableFacts: string[];
  compactedThroughSequence: number;

  constructor(config: ConversationSummaryConfig) {
    this.userProfile = config.userProfile;
    this.durableFacts = config.durableFacts;
    this.compactedThroughSequence = config.compactedThroughSequence;
  }
}
