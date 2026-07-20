export interface TextGenerationGateway {
  generateText(systemPrompt: string, userText: string): Promise<string>;
}
