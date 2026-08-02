export interface TextGenerationGateway {
  generateText(
    idUser: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string>;
}
